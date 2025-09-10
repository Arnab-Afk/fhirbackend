const express = require('express');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * GET /fhir/terminology/$autocomplete - Enhanced auto-complete for NAMASTE and ICD-11
 * Supports searching across multiple terminology systems with dual coding
 */
router.get('/$autocomplete', asyncHandler(async (req, res) => {
  const {
    search,
    system,
    language = 'en',
    limit = 20,
    includeDesignations = true,
    includeMappings = true,
    systems = 'namaste,icd11-tm2,unani' // Default systems to search
  } = req.query;

  if (!search || search.length < 2) {
    throw new ValidationError('search parameter must be at least 2 characters');
  }

  // Parse systems to search
  const systemsToSearch = systems.split(',').map(s => s.trim().toLowerCase());
  const systemUrls = {
    'namaste': 'https://ayush.gov.in/fhir/CodeSystem/namaste',
    'unani': 'https://ayush.gov.in/fhir/CodeSystem/unani',
    'icd11-tm2': 'http://id.who.int/icd/release/11/mms',
    'icd11': 'https://icd.who.int/browse11/l-m/en'
  };

  const results = [];

  // Search in specified systems
  for (const systemKey of systemsToSearch) {
    const systemUrl = systemUrls[systemKey];
    if (!systemUrl) continue;

    // Skip if specific system is requested and this isn't it
    if (system && system !== systemUrl) continue;

    const codeSystem = await prisma.codeSystem.findUnique({
      where: { url: systemUrl },
      include: {
        concepts: {
          where: {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { display: { contains: search, mode: 'insensitive' } },
              { definition: { contains: search, mode: 'insensitive' } },
              ...(includeDesignations ? [{
                designations: {
                  some: {
                    value: { contains: search, mode: 'insensitive' }
                  }
                }
              }] : [])
            ]
          },
          include: {
            designations: includeDesignations,
            codeSystem: {
              select: { name: true, url: true, title: true }
            }
          },
          take: Math.min(parseInt(limit), 50),
          orderBy: [
            { display: 'asc' },
            { code: 'asc' }
          ]
        }
      }
    });

    if (codeSystem && codeSystem.concepts.length > 0) {
      for (const concept of codeSystem.concepts) {
        const result = {
          system: codeSystem.url,
          systemName: codeSystem.name,
          code: concept.code,
          display: concept.display,
          definition: concept.definition,
          score: calculateRelevanceScore(concept, search),
          terminology: systemKey.toUpperCase()
        };

        // Add designations (translations)
        if (includeDesignations && concept.designations?.length > 0) {
          result.designations = concept.designations.map(d => ({
            language: d.language,
            value: d.value,
            use: d.use
          }));
        }

        // Find mappings if requested
        if (includeMappings) {
          const mappings = await findMappingsForConcept(concept.code, codeSystem.url);
          if (mappings.length > 0) {
            result.mappings = mappings;
          }
        }

        results.push(result);
      }
    }
  }

  // Sort by relevance score and limit results
  results.sort((a, b) => b.score - a.score);
  const limitedResults = results.slice(0, parseInt(limit));

  // Build FHIR Parameters response
  const response = {
    resourceType: 'Parameters',
    parameter: [
      {
        name: 'result',
        valueBoolean: limitedResults.length > 0
      },
      {
        name: 'matches',
        valueInteger: limitedResults.length
      },
      {
        name: 'searchTerm',
        valueString: search
      },
      {
        name: 'systemsSearched',
        valueString: systemsToSearch.join(', ')
      },
      ...limitedResults.map((result, index) => ({
        name: 'match',
        part: [
          {
            name: 'index',
            valueInteger: index
          },
          {
            name: 'score',
            valueDecimal: result.score
          },
          {
            name: 'code',
            valueCoding: {
              system: result.system,
              code: result.code,
              display: result.display,
              version: '1.0'
            }
          },
          {
            name: 'terminology',
            valueString: result.terminology
          },
          ...(result.definition ? [{
            name: 'definition',
            valueString: result.definition
          }] : []),
          ...(result.designations ? [{
            name: 'designations',
            valueString: result.designations.map(d => `${d.language}: ${d.value}`).join('; ')
          }] : []),
          ...(result.mappings ? [{
            name: 'mappings',
            part: result.mappings.map(mapping => ({
              name: 'mapping',
              part: [
                {
                  name: 'targetSystem',
                  valueUri: mapping.targetSystem
                },
                {
                  name: 'targetCode',
                  valueCode: mapping.targetCode
                },
                {
                  name: 'targetDisplay',
                  valueString: mapping.targetDisplay
                },
                {
                  name: 'equivalence',
                  valueCode: mapping.equivalence
                }
              ]
            }))
          }] : [])
        ]
      }))
    ]
  };

  res.json(response);
}));

/**
 * POST /fhir/terminology/$translate - Translate between NAMASTE and ICD-11
 */
router.post('/$translate', asyncHandler(async (req, res) => {
  const { code, system, target, reverse = false } = req.body.parameter?.reduce((acc, param) => {
    acc[param.name] = param.valueCode || param.valueUri || param.valueBoolean;
    return acc;
  }, {}) || {};

  if (!code || !system) {
    throw new ValidationError('code and system parameters are required');
  }

  // Find concept in source system
  const sourceConcept = await prisma.codeSystemConcept.findFirst({
    where: {
      code,
      codeSystem: {
        url: system
      }
    },
    include: {
      codeSystem: true,
      designations: true
    }
  });

  if (!sourceConcept) {
    return res.json({
      resourceType: 'Parameters',
      parameter: [{
        name: 'result',
        valueBoolean: false
      }, {
        name: 'message',
        valueString: `Code '${code}' not found in system '${system}'`
      }]
    });
  }

  // Find mappings
  const mappings = await findMappingsForConcept(code, system, target);

  if (mappings.length === 0) {
    return res.json({
      resourceType: 'Parameters',
      parameter: [{
        name: 'result',
        valueBoolean: false
      }, {
        name: 'message',
        valueString: `No mappings found for code '${code}' from '${system}' to '${target || 'any target system'}'`
      }]
    });
  }

  // Build response with all found mappings
  const response = {
    resourceType: 'Parameters',
    parameter: [
      {
        name: 'result',
        valueBoolean: true
      },
      {
        name: 'source',
        valueCoding: {
          system: sourceConcept.codeSystem.url,
          code: sourceConcept.code,
          display: sourceConcept.display
        }
      },
      ...mappings.map(mapping => ({
        name: 'match',
        part: [
          {
            name: 'equivalence',
            valueCode: mapping.equivalence
          },
          {
            name: 'concept',
            valueCoding: {
              system: mapping.targetSystem,
              code: mapping.targetCode,
              display: mapping.targetDisplay
            }
          },
          ...(mapping.comment ? [{
            name: 'comment',
            valueString: mapping.comment
          }] : [])
        ]
      }))
    ]
  };

  res.json(response);
}));

/**
 * GET /fhir/terminology/$dual-code-lookup - Look up dual codes (NAMASTE + ICD-11)
 */
router.get('/$dual-code-lookup', asyncHandler(async (req, res) => {
  const { 
    namasteCode, 
    icd11Code, 
    includeDetails = true,
    includeHierarchy = false 
  } = req.query;

  if (!namasteCode && !icd11Code) {
    throw new ValidationError('Either namasteCode or icd11Code parameter is required');
  }

  const result = {
    resourceType: 'Parameters',
    parameter: []
  };

  // Look up NAMASTE code
  if (namasteCode) {
    const namasteConcept = await prisma.codeSystemConcept.findFirst({
      where: {
        code: namasteCode,
        codeSystem: {
          url: 'https://ayush.gov.in/fhir/CodeSystem/namaste'
        }
      },
      include: {
        codeSystem: true,
        designations: true,
        ...(includeHierarchy && {
          parent: { include: { codeSystem: true } },
          children: { include: { codeSystem: true } }
        })
      }
    });

    if (namasteConcept) {
      result.parameter.push({
        name: 'namaste',
        part: [
          {
            name: 'code',
            valueCoding: {
              system: namasteConcept.codeSystem.url,
              code: namasteConcept.code,
              display: namasteConcept.display
            }
          },
          ...(includeDetails && namasteConcept.definition ? [{
            name: 'definition',
            valueString: namasteConcept.definition
          }] : []),
          ...(includeDetails && namasteConcept.designations.length > 0 ? [{
            name: 'designations',
            valueString: namasteConcept.designations.map(d => `${d.language}: ${d.value}`).join('; ')
          }] : [])
        ]
      });

      // Find ICD-11 mappings for this NAMASTE code
      const mappings = await findMappingsForConcept(namasteCode, namasteConcept.codeSystem.url);
      if (mappings.length > 0) {
        result.parameter.push({
          name: 'mappedIcd11Codes',
          part: mappings.map(mapping => ({
            name: 'mapping',
            part: [
              {
                name: 'targetCode',
                valueCoding: {
                  system: mapping.targetSystem,
                  code: mapping.targetCode,
                  display: mapping.targetDisplay
                }
              },
              {
                name: 'equivalence',
                valueCode: mapping.equivalence
              }
            ]
          }))
        });
      }
    }
  }

  // Look up ICD-11 code
  if (icd11Code) {
    const icd11Systems = [
      'http://id.who.int/icd/release/11/mms',
      'https://icd.who.int/browse11/l-m/en'
    ];

    for (const systemUrl of icd11Systems) {
      const icd11Concept = await prisma.codeSystemConcept.findFirst({
        where: {
          code: icd11Code,
          codeSystem: {
            url: systemUrl
          }
        },
        include: {
          codeSystem: true,
          designations: true
        }
      });

      if (icd11Concept) {
        result.parameter.push({
          name: 'icd11',
          part: [
            {
              name: 'code',
              valueCoding: {
                system: icd11Concept.codeSystem.url,
                code: icd11Concept.code,
                display: icd11Concept.display
              }
            },
            ...(includeDetails && icd11Concept.definition ? [{
              name: 'definition',
              valueString: icd11Concept.definition
            }] : [])
          ]
        });

        // Find reverse mappings (ICD-11 to NAMASTE)
        const reverseMappings = await findReverseMappingsForConcept(icd11Code, systemUrl);
        if (reverseMappings.length > 0) {
          result.parameter.push({
            name: 'mappedNamasteCodes',
            part: reverseMappings.map(mapping => ({
              name: 'reverseMapping',
              part: [
                {
                  name: 'sourceCode',
                  valueCoding: {
                    system: mapping.sourceSystem,
                    code: mapping.sourceCode,
                    display: mapping.sourceDisplay
                  }
                },
                {
                  name: 'equivalence',
                  valueCode: mapping.equivalence
                }
              ]
            }))
          });
        }
        break;
      }
    }
  }

  result.parameter.unshift({
    name: 'result',
    valueBoolean: result.parameter.length > 1 // More than just the result parameter
  });

  res.json(result);
}));

// Helper functions

/**
 * Calculate relevance score for search results
 */
function calculateRelevanceScore(concept, searchTerm) {
  let score = 0;
  const term = searchTerm.toLowerCase();

  // Exact code match gets highest score
  if (concept.code.toLowerCase() === term) {
    score += 100;
  } else if (concept.code.toLowerCase().includes(term)) {
    score += 50;
  }

  // Display name matches
  if (concept.display) {
    const display = concept.display.toLowerCase();
    if (display === term) {
      score += 90;
    } else if (display.startsWith(term)) {
      score += 70;
    } else if (display.includes(term)) {
      score += 40;
    }
  }

  // Definition matches
  if (concept.definition) {
    const definition = concept.definition.toLowerCase();
    if (definition.includes(term)) {
      score += 20;
    }
  }

  // Designation matches
  if (concept.designations) {
    for (const designation of concept.designations) {
      const value = designation.value.toLowerCase();
      if (value === term) {
        score += 60;
      } else if (value.includes(term)) {
        score += 30;
      }
    }
  }

  return score;
}

/**
 * Find mappings for a concept
 */
async function findMappingsForConcept(code, system, targetSystem = null) {
  const conceptMaps = await prisma.conceptMap.findMany({
    where: {
      sourceUri: system,
      ...(targetSystem && { targetUri: targetSystem })
    },
    include: {
      groups: {
        include: {
          elements: {
            where: { code },
            include: {
              targets: true
            }
          }
        }
      }
    }
  });

  const mappings = [];
  for (const conceptMap of conceptMaps) {
    for (const group of conceptMap.groups) {
      for (const element of group.elements) {
        for (const target of element.targets) {
          mappings.push({
            targetSystem: conceptMap.targetUri,
            targetCode: target.code,
            targetDisplay: target.display,
            equivalence: target.equivalence,
            comment: target.comment
          });
        }
      }
    }
  }

  return mappings;
}

/**
 * Find reverse mappings for a concept
 */
async function findReverseMappingsForConcept(code, system) {
  const conceptMaps = await prisma.conceptMap.findMany({
    where: {
      targetUri: system
    },
    include: {
      groups: {
        include: {
          elements: {
            include: {
              targets: {
                where: { code }
              }
            }
          }
        }
      }
    }
  });

  const mappings = [];
  for (const conceptMap of conceptMaps) {
    for (const group of conceptMap.groups) {
      for (const element of group.elements) {
        if (element.targets.length > 0) {
          mappings.push({
            sourceSystem: conceptMap.sourceUri,
            sourceCode: element.code,
            sourceDisplay: element.display,
            equivalence: element.targets[0].equivalence
          });
        }
      }
    }
  }

  return mappings;
}

module.exports = router;

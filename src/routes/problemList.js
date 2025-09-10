const express = require('express');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { authenticateApiKey, authorizeAccess, auditLog } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * POST /fhir/problem-list - Create FHIR Problem List with dual coding
 * Creates a complete problem list entry with NAMASTE and ICD-11 codes
 */
router.post('/', authenticateApiKey, authorizeAccess(['write']), auditLog('CREATE_PROBLEM_LIST'), asyncHandler(async (req, res) => {
  const {
    patientId,
    namasteCode,
    icd11Code,
    clinicalStatus = 'active',
    verificationStatus = 'confirmed',
    onset,
    severity,
    bodySite,
    notes,
    encounter
  } = req.body;

  // Validate required fields
  if (!patientId) {
    throw new ValidationError('patientId is required');
  }

  if (!namasteCode && !icd11Code) {
    throw new ValidationError('Either namasteCode or icd11Code is required');
  }

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      names: true,
      identifiers: true
    }
  });

  if (!patient) {
    throw new NotFoundError('Patient', patientId);
  }

  // Build coding array
  const coding = [];

  // Add NAMASTE code if provided
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
        designations: true
      }
    });

    if (!namasteConcept) {
      throw new ValidationError(`NAMASTE code '${namasteCode}' not found`);
    }

    coding.push({
      system: 'https://ayush.gov.in/fhir/CodeSystem/namaste',
      code: namasteConcept.code,
      display: namasteConcept.display,
      version: '1.0'
    });

    // If ICD-11 code not provided, try to find mapping
    if (!icd11Code) {
      const mappings = await findMappingsForConcept(namasteCode, 'https://ayush.gov.in/fhir/CodeSystem/namaste');
      if (mappings.length > 0) {
        coding.push({
          system: mappings[0].targetSystem,
          code: mappings[0].targetCode,
          display: mappings[0].targetDisplay,
          version: '1.0'
        });
      }
    }
  }

  // Add ICD-11 code if provided
  if (icd11Code) {
    const icd11Systems = [
      'http://id.who.int/icd/release/11/mms',
      'https://icd.who.int/browse11/l-m/en'
    ];

    let icd11Concept = null;
    for (const systemUrl of icd11Systems) {
      icd11Concept = await prisma.codeSystemConcept.findFirst({
        where: {
          code: icd11Code,
          codeSystem: {
            url: systemUrl
          }
        },
        include: {
          codeSystem: true
        }
      });

      if (icd11Concept) {
        coding.push({
          system: systemUrl,
          code: icd11Concept.code,
          display: icd11Concept.display,
          version: '1.0'
        });
        break;
      }
    }

    if (!icd11Concept) {
      throw new ValidationError(`ICD-11 code '${icd11Code}' not found`);
    }

    // If NAMASTE code not provided, try to find reverse mapping
    if (!namasteCode) {
      const reverseMappings = await findReverseMappingsForConcept(icd11Code, icd11Concept.codeSystem.url);
      if (reverseMappings.length > 0) {
        const namasteConcept = await prisma.codeSystemConcept.findFirst({
          where: {
            code: reverseMappings[0].sourceCode,
            codeSystem: {
              url: reverseMappings[0].sourceSystem
            }
          },
          include: {
            codeSystem: true
          }
        });

        if (namasteConcept) {
          coding.push({
            system: reverseMappings[0].sourceSystem,
            code: namasteConcept.code,
            display: namasteConcept.display,
            version: '1.0'
          });
        }
      }
    }
  }

  if (coding.length === 0) {
    throw new ValidationError('Unable to create problem list entry - no valid codes found');
  }

  // Create the Condition resource
  const condition = await prisma.condition.create({
    data: {
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: clinicalStatus,
          display: clinicalStatus
        }]
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: verificationStatus,
          display: verificationStatus
        }]
      },
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-category',
          code: 'problem-list-item',
          display: 'Problem List Item'
        }]
      }],
      severity: severity ? {
        coding: [{
          system: 'http://snomed.info/sct',
          code: severity.code,
          display: severity.display
        }]
      } : null,
      code: {
        coding: coding,
        text: coding[0].display
      },
      bodySite: bodySite ? [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: bodySite.code,
          display: bodySite.display
        }]
      }] : [],
      subjectId: patientId,
      encounterId: encounter?.reference?.replace('Encounter/', ''),
      onsetDateTime: onset?.dateTime ? new Date(onset.dateTime) : null,
      recordedDate: new Date(),
      note: notes ? [{
        text: notes,
        time: new Date().toISOString()
      }] : []
    },
    include: {
      subject: {
        include: {
          names: true,
          identifiers: true
        }
      }
    }
  });

  // Build FHIR Condition response
  const fhirCondition = {
    resourceType: 'Condition',
    id: condition.id,
    meta: {
      versionId: '1',
      lastUpdated: condition.updatedAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Condition']
    },
    clinicalStatus: condition.clinicalStatus,
    verificationStatus: condition.verificationStatus,
    category: condition.category,
    severity: condition.severity,
    code: condition.code,
    bodySite: condition.bodySite,
    subject: {
      reference: `Patient/${condition.subjectId}`,
      display: condition.subject.names[0]?.family ?
        `${condition.subject.names[0].given.join(' ')} ${condition.subject.names[0].family}` :
        'Unknown Patient'
    },
    encounter: condition.encounterId ? {
      reference: `Encounter/${condition.encounterId}`
    } : undefined,
    onsetDateTime: condition.onsetDateTime?.toISOString(),
    recordedDate: condition.recordedDate?.toISOString(),
    note: condition.note
  };

  res.status(201).json(fhirCondition);
}));

/**
 * GET /fhir/problem-list/:patientId - Get problem list for patient
 */
router.get('/:patientId', asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { 
    status,
    category = 'problem-list-item',
    _count = 20,
    _offset = 0
  } = req.query;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      names: true,
      identifiers: true
    }
  });

  if (!patient) {
    throw new NotFoundError('Patient', patientId);
  }

  // Build query filters
  const where = {
    subjectId: patientId
  };

  if (status) {
    where.clinicalStatus = {
      path: ['coding', 0, 'code'],
      equals: status
    };
  }

  // Get conditions
  const conditions = await prisma.condition.findMany({
    where,
    include: {
      subject: {
        include: {
          names: true,
          identifiers: true
        }
      }
    },
    take: parseInt(_count),
    skip: parseInt(_offset),
    orderBy: { recordedDate: 'desc' }
  });

  // Convert to FHIR Bundle
  const bundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    timestamp: new Date().toISOString(),
    total: await prisma.condition.count({ where }),
    entry: conditions.map(condition => ({
      resource: {
        resourceType: 'Condition',
        id: condition.id,
        meta: {
          versionId: '1',
          lastUpdated: condition.updatedAt.toISOString()
        },
        clinicalStatus: condition.clinicalStatus,
        verificationStatus: condition.verificationStatus,
        category: condition.category,
        severity: condition.severity,
        code: condition.code,
        bodySite: condition.bodySite,
        subject: {
          reference: `Patient/${condition.subjectId}`,
          display: condition.subject.names[0]?.family ?
            `${condition.subject.names[0].given.join(' ')} ${condition.subject.names[0].family}` :
            'Unknown Patient'
        },
        encounter: condition.encounterId ? {
          reference: `Encounter/${condition.encounterId}`
        } : undefined,
        onsetDateTime: condition.onsetDateTime?.toISOString(),
        recordedDate: condition.recordedDate?.toISOString(),
        note: condition.note
      }
    }))
  };

  res.json(bundle);
}));

/**
 * GET /fhir/problem-list/:patientId/summary - Get problem list summary with analytics
 */
router.get('/:patientId/summary', asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      names: true,
      identifiers: true
    }
  });

  if (!patient) {
    throw new NotFoundError('Patient', patientId);
  }

  // Get condition statistics
  const totalConditions = await prisma.condition.count({
    where: { subjectId: patientId }
  });

  const activeConditions = await prisma.condition.count({
    where: {
      subjectId: patientId,
      clinicalStatus: {
        path: ['coding', 0, 'code'],
        equals: 'active'
      }
    }
  });

  const resolvedConditions = await prisma.condition.count({
    where: {
      subjectId: patientId,
      clinicalStatus: {
        path: ['coding', 0, 'code'],
        equals: 'resolved'
      }
    }
  });

  // Get recent conditions
  const recentConditions = await prisma.condition.findMany({
    where: { subjectId: patientId },
    include: {
      subject: {
        include: {
          names: true
        }
      }
    },
    take: 5,
    orderBy: { recordedDate: 'desc' }
  });

  // Analyze terminology usage
  const terminologyStats = await analyzeTerminologyUsage(patientId);

  const summary = {
    resourceType: 'Parameters',
    parameter: [
      {
        name: 'patient',
        valueReference: {
          reference: `Patient/${patientId}`,
          display: patient.names[0]?.family ?
            `${patient.names[0].given.join(' ')} ${patient.names[0].family}` :
            'Unknown Patient'
        }
      },
      {
        name: 'totalConditions',
        valueInteger: totalConditions
      },
      {
        name: 'activeConditions',
        valueInteger: activeConditions
      },
      {
        name: 'resolvedConditions',
        valueInteger: resolvedConditions
      },
      {
        name: 'terminologyStats',
        part: [
          {
            name: 'namasteCodings',
            valueInteger: terminologyStats.namaste
          },
          {
            name: 'icd11Codings',
            valueInteger: terminologyStats.icd11
          },
          {
            name: 'dualCodings',
            valueInteger: terminologyStats.dual
          }
        ]
      },
      {
        name: 'recentConditions',
        part: recentConditions.map((condition, index) => ({
          name: `condition${index + 1}`,
          part: [
            {
              name: 'id',
              valueString: condition.id
            },
            {
              name: 'code',
              valueCodeableConcept: condition.code
            },
            {
              name: 'recordedDate',
              valueDateTime: condition.recordedDate?.toISOString()
            }
          ]
        }))
      }
    ]
  };

  res.json(summary);
}));

// Helper functions

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

/**
 * Analyze terminology usage for a patient
 */
async function analyzeTerminologyUsage(patientId) {
  const conditions = await prisma.condition.findMany({
    where: { subjectId: patientId },
    select: { code: true }
  });

  let namasteCount = 0;
  let icd11Count = 0;
  let dualCount = 0;

  for (const condition of conditions) {
    if (condition.code && condition.code.coding) {
      const codings = Array.isArray(condition.code.coding) ? condition.code.coding : [condition.code.coding];
      
      const hasNamaste = codings.some(c => c.system === 'https://ayush.gov.in/fhir/CodeSystem/namaste');
      const hasIcd11 = codings.some(c => 
        c.system === 'http://id.who.int/icd/release/11/mms' ||
        c.system === 'https://icd.who.int/browse11/l-m/en'
      );

      if (hasNamaste) namasteCount++;
      if (hasIcd11) icd11Count++;
      if (hasNamaste && hasIcd11) dualCount++;
    }
  }

  return {
    namaste: namasteCount,
    icd11: icd11Count,
    dual: dualCount
  };
}

module.exports = router;

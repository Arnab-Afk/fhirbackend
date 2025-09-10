const express = require('express');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { authenticateApiKey, authorizeAccess, auditLog } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * GET /fhir/CodeSystem - Search CodeSystems
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    url,
    version,
    name,
    status,
    _count = 20,
    _offset = 0
  } = req.query;

  const where = {};

  if (url) where.url = url;
  if (version) where.version = version;
  if (name) where.name = { contains: name, mode: 'insensitive' };
  if (status) where.status = status;

  const codeSystems = await prisma.codeSystem.findMany({
    where,
    include: {
      concepts: {
        take: 10, // Limit concepts for performance
        include: {
          designations: true,
          children: true
        }
      },
      _count: {
        select: { concepts: true }
      }
    },
    take: parseInt(_count),
    skip: parseInt(_offset),
    orderBy: { updatedAt: 'desc' }
  });

  // Convert to FHIR Bundle
  const bundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: await prisma.codeSystem.count({ where }),
    entry: codeSystems.map(cs => ({
      resource: {
        resourceType: 'CodeSystem',
        id: cs.id,
        url: cs.url,
        version: cs.version,
        name: cs.name,
        title: cs.title,
        status: cs.status,
        experimental: cs.experimental,
        date: cs.date?.toISOString(),
        publisher: cs.publisher,
        description: cs.description,
        content: cs.content,
        supplements: cs.supplements,
        count: cs._count.concepts,
        caseSensitive: cs.caseSensitive,
        compositional: cs.compositional,
        versionNeeded: cs.versionNeeded,
        concept: cs.concepts.map(concept => ({
          code: concept.code,
          display: concept.display,
          definition: concept.definition,
          designation: concept.designations.map(d => ({
            language: d.language,
            use: d.use,
            value: d.value
          }))
        }))
      }
    }))
  };

  res.json(bundle);
}));

/**
 * GET /fhir/CodeSystem/:id - Read CodeSystem by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const codeSystem = await prisma.codeSystem.findUnique({
    where: { id },
    include: {
      concepts: {
        include: {
          designations: true,
          children: true,
          parent: true
        }
      },
      _count: {
        select: { concepts: true }
      }
    }
  });

  if (!codeSystem) {
    throw new NotFoundError('CodeSystem', id);
  }

  // Convert to FHIR CodeSystem
  const fhirCodeSystem = {
    resourceType: 'CodeSystem',
    id: codeSystem.id,
    url: codeSystem.url,
    version: codeSystem.version,
    name: codeSystem.name,
    title: codeSystem.title,
    status: codeSystem.status,
    experimental: codeSystem.experimental,
    date: codeSystem.date?.toISOString(),
    publisher: codeSystem.publisher,
    description: codeSystem.description,
    content: codeSystem.content,
    supplements: codeSystem.supplements,
    count: codeSystem._count.concepts,
    caseSensitive: codeSystem.caseSensitive,
    compositional: codeSystem.compositional,
    versionNeeded: codeSystem.versionNeeded,
    concept: codeSystem.concepts.map(concept => ({
      code: concept.code,
      display: concept.display,
      definition: concept.definition,
      designation: concept.designations.map(d => ({
        language: d.language,
        use: d.use,
        value: d.value
      }))
    }))
  };

  res.json(fhirCodeSystem);
}));

/**
 * POST /fhir/CodeSystem - Create CodeSystem
 */
router.post('/', authenticateApiKey, authorizeAccess(['write']), auditLog('CREATE'), asyncHandler(async (req, res) => {
  const codeSystemData = req.body;

  // Validate required fields
  if (!codeSystemData.url) {
    throw new ValidationError('CodeSystem.url is required');
  }

  // Check if CodeSystem with this URL already exists
  const existing = await prisma.codeSystem.findUnique({
    where: { url: codeSystemData.url }
  });

  if (existing) {
    throw new ValidationError(`CodeSystem with URL ${codeSystemData.url} already exists`);
  }

  // Create CodeSystem
  const codeSystem = await prisma.codeSystem.create({
    data: {
      url: codeSystemData.url,
      version: codeSystemData.version,
      name: codeSystemData.name,
      title: codeSystemData.title,
      status: codeSystemData.status || 'active',
      experimental: codeSystemData.experimental || false,
      date: codeSystemData.date ? new Date(codeSystemData.date) : new Date(),
      publisher: codeSystemData.publisher,
      description: codeSystemData.description,
      content: codeSystemData.content || 'complete',
      supplements: codeSystemData.supplements,
      count: codeSystemData.count,
      caseSensitive: codeSystemData.caseSensitive || false,
      compositional: codeSystemData.compositional || false,
      versionNeeded: codeSystemData.versionNeeded || false
    }
  });

  // Create concepts if provided
  if (codeSystemData.concept && Array.isArray(codeSystemData.concept)) {
    for (const concept of codeSystemData.concept) {
      await createConceptRecursive(codeSystem.id, concept);
    }
  }

  // Return created CodeSystem
  const createdCodeSystem = await prisma.codeSystem.findUnique({
    where: { id: codeSystem.id },
    include: {
      concepts: {
        include: {
          designations: true
        }
      },
      _count: {
        select: { concepts: true }
      }
    }
  });

  const fhirCodeSystem = {
    resourceType: 'CodeSystem',
    id: createdCodeSystem.id,
    url: createdCodeSystem.url,
    version: createdCodeSystem.version,
    name: createdCodeSystem.name,
    title: createdCodeSystem.title,
    status: createdCodeSystem.status,
    experimental: createdCodeSystem.experimental,
    date: createdCodeSystem.date?.toISOString(),
    publisher: createdCodeSystem.publisher,
    description: createdCodeSystem.description,
    content: createdCodeSystem.content,
    supplements: createdCodeSystem.supplements,
    count: createdCodeSystem._count.concepts,
    caseSensitive: createdCodeSystem.caseSensitive,
    compositional: createdCodeSystem.compositional,
    versionNeeded: createdCodeSystem.versionNeeded,
    concept: createdCodeSystem.concepts.map(concept => ({
      code: concept.code,
      display: concept.display,
      definition: concept.definition,
      designation: concept.designations.map(d => ({
        language: d.language,
        use: d.use,
        value: d.value
      }))
    }))
  };

  res.status(201).json(fhirCodeSystem);
}));

/**
 * PUT /fhir/CodeSystem/:id - Update CodeSystem
 */
router.put('/:id', authenticateApiKey, authorizeAccess(['write']), auditLog('UPDATE'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const codeSystemData = req.body;

  // Check if CodeSystem exists
  const existing = await prisma.codeSystem.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('CodeSystem', id);
  }

  // Update CodeSystem
  const updatedCodeSystem = await prisma.codeSystem.update({
    where: { id },
    data: {
      version: codeSystemData.version,
      name: codeSystemData.name,
      title: codeSystemData.title,
      status: codeSystemData.status,
      experimental: codeSystemData.experimental,
      date: codeSystemData.date ? new Date(codeSystemData.date) : new Date(),
      publisher: codeSystemData.publisher,
      description: codeSystemData.description,
      content: codeSystemData.content,
      supplements: codeSystemData.supplements,
      count: codeSystemData.count,
      caseSensitive: codeSystemData.caseSensitive,
      compositional: codeSystemData.compositional,
      versionNeeded: codeSystemData.versionNeeded
    },
    include: {
      concepts: {
        include: {
          designations: true
        }
      },
      _count: {
        select: { concepts: true }
      }
    }
  });

  const fhirCodeSystem = {
    resourceType: 'CodeSystem',
    id: updatedCodeSystem.id,
    url: updatedCodeSystem.url,
    version: updatedCodeSystem.version,
    name: updatedCodeSystem.name,
    title: updatedCodeSystem.title,
    status: updatedCodeSystem.status,
    experimental: updatedCodeSystem.experimental,
    date: updatedCodeSystem.date?.toISOString(),
    publisher: updatedCodeSystem.publisher,
    description: updatedCodeSystem.description,
    content: updatedCodeSystem.content,
    supplements: updatedCodeSystem.supplements,
    count: updatedCodeSystem._count.concepts,
    caseSensitive: updatedCodeSystem.caseSensitive,
    compositional: updatedCodeSystem.compositional,
    versionNeeded: updatedCodeSystem.versionNeeded,
    concept: updatedCodeSystem.concepts.map(concept => ({
      code: concept.code,
      display: concept.display,
      definition: concept.definition,
      designation: updatedCodeSystem.designations?.map(d => ({
        language: d.language,
        use: d.use,
        value: d.value
      }))
    }))
  };

  res.json(fhirCodeSystem);
}));

/**
 * DELETE /fhir/CodeSystem/:id - Delete CodeSystem
 */
router.delete('/:id', authenticateApiKey, authorizeAccess(['write']), auditLog('DELETE'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if CodeSystem exists
  const existing = await prisma.codeSystem.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('CodeSystem', id);
  }

  // Delete CodeSystem (cascade will delete concepts)
  await prisma.codeSystem.delete({
    where: { id }
  });

  res.status(204).send();
}));

/**
 * POST /fhir/CodeSystem/:id/$lookup - Lookup code in CodeSystem
 */
router.post('/:id/$lookup', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, system, version, display, property } = req.body.parameter?.reduce((acc, param) => {
    acc[param.name] = param.valueCode || param.valueString || param.valueUri;
    return acc;
  }, {}) || {};

  if (!code) {
    throw new ValidationError('code parameter is required');
  }

  // Find the CodeSystem
  const codeSystem = await prisma.codeSystem.findUnique({
    where: { id },
    include: {
      concepts: {
        where: { code },
        include: {
          designations: true,
          parent: true,
          children: true
        }
      }
    }
  });

  if (!codeSystem) {
    throw new NotFoundError('CodeSystem', id);
  }

  // Find the concept
  const concept = codeSystem.concepts[0];

  if (!concept) {
    // Return not found
    return res.json({
      resourceType: 'Parameters',
      parameter: [{
        name: 'result',
        valueBoolean: false
      }]
    });
  }

  // Build response parameters
  const parameters = [
    {
      name: 'result',
      valueBoolean: true
    },
    {
      name: 'name',
      valueString: codeSystem.name
    },
    {
      name: 'version',
      valueString: codeSystem.version || '1.0'
    },
    {
      name: 'display',
      valueString: concept.display
    },
    {
      name: 'code',
      valueCode: concept.code
    },
    {
      name: 'system',
      valueUri: codeSystem.url
    }
  ];

  // Add definition if available
  if (concept.definition) {
    parameters.push({
      name: 'definition',
      valueString: concept.definition
    });
  }

  // Add designations
  concept.designations.forEach((designation, index) => {
    parameters.push({
      name: 'designation',
      part: [
        {
          name: 'language',
          valueCode: designation.language
        },
        {
          name: 'value',
          valueString: designation.value
        }
      ]
    });
  });

  // Add property information
  if (property) {
    // For TM2 data, add relevant properties
    if (property === 'parent') {
      if (concept.parent) {
        parameters.push({
          name: 'property',
          part: [
            {
              name: 'code',
              valueCode: 'parent'
            },
            {
              name: 'value',
              valueCode: concept.parent.code
            }
          ]
        });
      }
    } else if (property === 'child') {
      concept.children.forEach(child => {
        parameters.push({
          name: 'property',
          part: [
            {
              name: 'code',
              valueCode: 'child'
            },
            {
              name: 'value',
              valueCode: child.code
            }
          ]
        });
      });
    }
  }

  res.json({
    resourceType: 'Parameters',
    parameter: parameters
  });
}));

/**
 * POST /fhir/CodeSystem/:id/$validate-code - Validate code in CodeSystem
 */
router.post('/:id/$validate-code', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, system, version, display, date, abstract } = req.body.parameter?.reduce((acc, param) => {
    acc[param.name] = param.valueCode || param.valueString || param.valueUri || param.valueBoolean;
    return acc;
  }, {}) || {};

  if (!code) {
    throw new ValidationError('code parameter is required');
  }

  // Find the CodeSystem
  const codeSystem = await prisma.codeSystem.findUnique({
    where: { id },
    include: {
      concepts: {
        where: { code },
        include: {
          designations: true
        }
      }
    }
  });

  if (!codeSystem) {
    throw new NotFoundError('CodeSystem', id);
  }

  // Check if code exists
  const concept = codeSystem.concepts[0];
  const isValid = !!concept;

  // Build response
  const parameters = [
    {
      name: 'result',
      valueBoolean: isValid
    },
    {
      name: 'code',
      valueCode: code
    },
    {
      name: 'system',
      valueUri: codeSystem.url
    },
    {
      name: 'version',
      valueString: codeSystem.version || '1.0'
    }
  ];

  if (isValid) {
    parameters.push({
      name: 'display',
      valueString: concept.display
    });

    if (concept.definition) {
      parameters.push({
        name: 'definition',
        valueString: concept.definition
      });
    }

    // Check display match if provided
    if (display && concept.display !== display) {
      parameters.push({
        name: 'message',
        valueString: `Display mismatch: expected '${concept.display}', got '${display}'`
      });
    }
  } else {
    parameters.push({
      name: 'message',
      valueString: `Code '${code}' not found in CodeSystem '${codeSystem.name}'`
    });
  }

  res.json({
    resourceType: 'Parameters',
    parameter: parameters
  });
}));

/**
 * GET /fhir/CodeSystem/$autocomplete - Auto-complete search for codes
 */
router.get('/$autocomplete', asyncHandler(async (req, res) => {
  const {
    system,
    search,
    limit = 10,
    includeDesignations = true
  } = req.query;

  if (!system) {
    throw new ValidationError('system parameter is required');
  }

  if (!search || search.length < 2) {
    throw new ValidationError('search parameter must be at least 2 characters');
  }

  // Find the CodeSystem
  const codeSystem = await prisma.codeSystem.findUnique({
    where: { url: system },
    include: {
      concepts: {
        where: {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { display: { contains: search, mode: 'insensitive' } },
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
          designations: includeDesignations
        },
        take: parseInt(limit),
        orderBy: [
          { display: 'asc' },
          { code: 'asc' }
        ]
      }
    }
  });

  if (!codeSystem) {
    throw new NotFoundError('CodeSystem', system);
  }

  // Format results
  const results = codeSystem.concepts.map(concept => ({
    code: concept.code,
    display: concept.display,
    system: codeSystem.url,
    version: codeSystem.version,
    ...(includeDesignations && concept.designations.length > 0 && {
      designation: concept.designations.map(d => ({
        language: d.language,
        value: d.value,
        use: d.use
      }))
    })
  }));

  res.json({
    resourceType: 'Parameters',
    parameter: [
      {
        name: 'result',
        valueBoolean: results.length > 0
      },
      {
        name: 'matches',
        valueInteger: results.length
      },
      ...results.map((result, index) => ({
        name: 'match',
        part: [
          {
            name: 'index',
            valueInteger: index
          },
          {
            name: 'code',
            valueCoding: {
              system: result.system,
              code: result.code,
              display: result.display,
              version: result.version
            }
          },
          ...(result.designation ? [{
            name: 'designation',
            valueString: result.designation.map(d => `${d.language}: ${d.value}`).join('; ')
          }] : [])
        ]
      }))
    ]
  });
}));

/**
 * Helper function to recursively create concepts and their hierarchy
 */
async function createConceptRecursive(codeSystemId, concept) {
  const createdConcept = await prisma.codeSystemConcept.create({
    data: {
      code: concept.code,
      display: concept.display,
      definition: concept.definition,
      codeSystemId: codeSystemId
    }
  });

  // Create designations if provided
  if (concept.designation && Array.isArray(concept.designation)) {
    for (const designation of concept.designation) {
      await prisma.codeSystemDesignation.create({
        data: {
          language: designation.language,
          value: designation.value,
          use: designation.use,
          conceptId: createdConcept.id
        }
      });
    }
  }

  // Create child concepts recursively
  if (concept.concept && Array.isArray(concept.concept)) {
    for (const childConcept of concept.concept) {
      const child = await createConceptRecursive(codeSystemId, childConcept);
      // Update parent relationship
      await prisma.codeSystemConcept.update({
        where: { id: child.id },
        data: { parentId: createdConcept.id }
      });
    }
  }

  return createdConcept;
}

module.exports = router;

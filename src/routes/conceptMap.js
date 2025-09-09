const express = require('express');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * GET /fhir/ConceptMap - Search ConceptMaps
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    url,
    version,
    name,
    status,
    source,
    target,
    _count = 20,
    _offset = 0
  } = req.query;

  const where = {};

  if (url) where.url = url;
  if (version) where.version = version;
  if (name) where.name = { contains: name, mode: 'insensitive' };
  if (status) where.status = status;

  const conceptMaps = await prisma.conceptMap.findMany({
    where,
    include: {
      groups: {
        include: {
          elements: {
            include: {
              targets: {
                include: {
                  dependsOn: true
                }
              }
            }
          }
        }
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
    total: await prisma.conceptMap.count({ where }),
    entry: conceptMaps.map(cm => ({
      resource: {
        resourceType: 'ConceptMap',
        id: cm.id,
        url: cm.url,
        version: cm.version,
        name: cm.name,
        title: cm.title,
        status: cm.status,
        experimental: cm.experimental,
        date: cm.date?.toISOString(),
        publisher: cm.publisher,
        description: cm.description,
        sourceUri: cm.sourceUri,
        targetUri: cm.targetUri,
        group: cm.groups.map(group => ({
          source: group.source,
          target: group.target,
          element: group.elements.map(element => ({
            code: element.code,
            display: element.display,
            target: element.targets.map(target => ({
              code: target.code,
              display: target.display,
              equivalence: target.equivalence,
              comment: target.comment,
              dependsOn: target.dependsOn.map(dep => ({
                property: dep.property,
                system: dep.system,
                value: dep.value,
                display: dep.display
              }))
            }))
          }))
        }))
      }
    }))
  };

  res.json(bundle);
}));

/**
 * GET /fhir/ConceptMap/:id - Read ConceptMap by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const conceptMap = await prisma.conceptMap.findUnique({
    where: { id },
    include: {
      groups: {
        include: {
          elements: {
            include: {
              targets: {
                include: {
                  dependsOn: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!conceptMap) {
    throw new NotFoundError('ConceptMap', id);
  }

  // Convert to FHIR ConceptMap
  const fhirConceptMap = {
    resourceType: 'ConceptMap',
    id: conceptMap.id,
    url: conceptMap.url,
    version: conceptMap.version,
    name: conceptMap.name,
    title: conceptMap.title,
    status: conceptMap.status,
    experimental: conceptMap.experimental,
    date: conceptMap.date?.toISOString(),
    publisher: conceptMap.publisher,
    description: conceptMap.description,
    sourceUri: conceptMap.sourceUri,
    targetUri: conceptMap.targetUri,
    group: conceptMap.groups.map(group => ({
      source: group.source,
      target: group.target,
      element: group.elements.map(element => ({
        code: element.code,
        display: element.display,
        target: element.targets.map(target => ({
          code: target.code,
          display: target.display,
          equivalence: target.equivalence,
          comment: target.comment,
          dependsOn: target.dependsOn.map(dep => ({
            property: dep.property,
            system: dep.system,
            value: dep.value,
            display: dep.display
          }))
        }))
      }))
    }))
  };

  res.json(fhirConceptMap);
}));

/**
 * POST /fhir/ConceptMap - Create ConceptMap
 */
router.post('/', asyncHandler(async (req, res) => {
  const conceptMapData = req.body;

  // Validate required fields
  if (!conceptMapData.url) {
    throw new ValidationError('ConceptMap.url is required');
  }

  // Check if ConceptMap with this URL already exists
  const existing = await prisma.conceptMap.findUnique({
    where: { url: conceptMapData.url }
  });

  if (existing) {
    throw new ValidationError(`ConceptMap with URL ${conceptMapData.url} already exists`);
  }

  // Create ConceptMap
  const conceptMap = await prisma.conceptMap.create({
    data: {
      url: conceptMapData.url,
      version: conceptMapData.version,
      name: conceptMapData.name,
      title: conceptMapData.title,
      status: conceptMapData.status || 'active',
      experimental: conceptMapData.experimental || false,
      date: conceptMapData.date ? new Date(conceptMapData.date) : new Date(),
      publisher: conceptMapData.publisher,
      description: conceptMapData.description,
      sourceUri: conceptMapData.sourceUri,
      targetUri: conceptMapData.targetUri
    }
  });

  // Create groups and elements if provided
  if (conceptMapData.group && Array.isArray(conceptMapData.group)) {
    for (const group of conceptMapData.group) {
      await createGroupRecursive(conceptMap.id, group);
    }
  }

  // Return created ConceptMap
  const createdConceptMap = await prisma.conceptMap.findUnique({
    where: { id: conceptMap.id },
    include: {
      groups: {
        include: {
          elements: {
            include: {
              targets: {
                include: {
                  dependsOn: true
                }
              }
            }
          }
        }
      }
    }
  });

  const fhirConceptMap = {
    resourceType: 'ConceptMap',
    id: createdConceptMap.id,
    url: createdConceptMap.url,
    version: createdConceptMap.version,
    name: createdConceptMap.name,
    title: createdConceptMap.title,
    status: createdConceptMap.status,
    experimental: createdConceptMap.experimental,
    date: createdConceptMap.date?.toISOString(),
    publisher: createdConceptMap.publisher,
    description: createdConceptMap.description,
    sourceUri: createdConceptMap.sourceUri,
    targetUri: createdConceptMap.targetUri,
    group: createdConceptMap.groups.map(group => ({
      source: group.source,
      target: group.target,
      element: group.elements.map(element => ({
        code: element.code,
        display: element.display,
        target: element.targets.map(target => ({
          code: target.code,
          display: target.display,
          equivalence: target.equivalence,
          comment: target.comment,
          dependsOn: target.dependsOn.map(dep => ({
            property: dep.property,
            system: dep.system,
            value: dep.value,
            display: dep.display
          }))
        }))
      }))
    }))
  };

  res.status(201).json(fhirConceptMap);
}));

/**
 * PUT /fhir/ConceptMap/:id - Update ConceptMap
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conceptMapData = req.body;

  // Check if ConceptMap exists
  const existing = await prisma.conceptMap.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('ConceptMap', id);
  }

  // Update ConceptMap
  const updatedConceptMap = await prisma.conceptMap.update({
    where: { id },
    data: {
      version: conceptMapData.version,
      name: conceptMapData.name,
      title: conceptMapData.title,
      status: conceptMapData.status,
      experimental: conceptMapData.experimental,
      date: conceptMapData.date ? new Date(conceptMapData.date) : new Date(),
      publisher: conceptMapData.publisher,
      description: conceptMapData.description,
      sourceUri: conceptMapData.sourceUri,
      targetUri: conceptMapData.targetUri
    },
    include: {
      groups: {
        include: {
          elements: {
            include: {
              targets: {
                include: {
                  dependsOn: true
                }
              }
            }
          }
        }
      }
    }
  });

  const fhirConceptMap = {
    resourceType: 'ConceptMap',
    id: updatedConceptMap.id,
    url: updatedConceptMap.url,
    version: updatedConceptMap.version,
    name: updatedConceptMap.name,
    title: updatedConceptMap.title,
    status: updatedConceptMap.status,
    experimental: updatedConceptMap.experimental,
    date: updatedConceptMap.date?.toISOString(),
    publisher: updatedConceptMap.publisher,
    description: updatedConceptMap.description,
    sourceUri: updatedConceptMap.sourceUri,
    targetUri: updatedConceptMap.targetUri,
    group: updatedConceptMap.groups.map(group => ({
      source: group.source,
      target: group.target,
      element: group.elements.map(element => ({
        code: element.code,
        display: element.display,
        target: element.targets.map(target => ({
          code: target.code,
          display: target.display,
          equivalence: target.equivalence,
          comment: target.comment,
          dependsOn: target.dependsOn.map(dep => ({
            property: dep.property,
            system: dep.system,
            value: dep.value,
            display: dep.display
          }))
        }))
      }))
    }))
  };

  res.json(fhirConceptMap);
}));

/**
 * DELETE /fhir/ConceptMap/:id - Delete ConceptMap
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if ConceptMap exists
  const existing = await prisma.conceptMap.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('ConceptMap', id);
  }

  // Delete ConceptMap (cascade will delete groups, elements, targets)
  await prisma.conceptMap.delete({
    where: { id }
  });

  res.status(204).send();
}));

/**
 * POST /fhir/ConceptMap/:id/$translate - Translate codes using ConceptMap
 */
router.post('/:id/$translate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, system, target, reverse = false } = req.body.parameter?.reduce((acc, param) => {
    acc[param.name] = param.valueCode || param.valueUri;
    return acc;
  }, {}) || {};

  if (!code || !system) {
    throw new ValidationError('code and system parameters are required');
  }

  // Find the ConceptMap
  const conceptMap = await prisma.conceptMap.findUnique({
    where: { id },
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

  if (!conceptMap) {
    throw new NotFoundError('ConceptMap', id);
  }

  // Find matching element
  let matchingElement = null;
  for (const group of conceptMap.groups) {
    if (group.elements.length > 0) {
      matchingElement = group.elements[0];
      break;
    }
  }

  if (!matchingElement) {
    // Return no match found
    return res.json({
      resourceType: 'Parameters',
      parameter: [{
        name: 'result',
        valueBoolean: false
      }]
    });
  }

  // Return translation result
  const result = {
    resourceType: 'Parameters',
    parameter: [
      {
        name: 'result',
        valueBoolean: true
      },
      {
        name: 'match',
        part: [
          {
            name: 'equivalence',
            valueCode: matchingElement.targets[0]?.equivalence || 'equivalent'
          },
          {
            name: 'concept',
            valueCoding: {
              system: conceptMap.targetUri,
              code: matchingElement.targets[0]?.code,
              display: matchingElement.targets[0]?.display
            }
          }
        ]
      }
    ]
  };

  res.json(result);
}));

/**
 * POST /fhir/ConceptMap/:id/$validate - Validate concept mapping
 */
router.post('/:id/$validate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const params = req.body.parameter?.reduce((acc, param) => {
    if (param.valueCoding) {
      acc[param.name] = param.valueCoding.code;
      acc[`${param.name}System`] = param.valueCoding.system;
    } else {
      acc[param.name] = param.valueCode || param.valueUri || param.valueString;
    }
    return acc;
  }, {}) || {};

  const { source, target, concept, conceptSystem, system, targetsystem } = params;

  if (!source || !target || !concept) {
    throw new ValidationError('source, target, and concept parameters are required');
  }

  // Find the ConceptMap
  const conceptMap = await prisma.conceptMap.findUnique({
    where: { id },
    include: {
      groups: {
        include: {
          elements: {
            where: { code: concept },
            include: {
              targets: true
            }
          }
        }
      }
    }
  });

  if (!conceptMap) {
    throw new NotFoundError('ConceptMap', id);
  }

  // Check if mapping exists
  let isValid = false;
  let matchingTarget = null;

  for (const group of conceptMap.groups) {
    if (group.elements.length > 0) {
      const element = group.elements[0];
      // Check if any target exists in this group (since group.target is the target system)
      if (element.targets.length > 0) {
        matchingTarget = element.targets[0]; // Get the first target
        isValid = true;
        break;
      }
    }
  }

  // Build response
  const parameters = [
    {
      name: 'result',
      valueBoolean: isValid
    },
    {
      name: 'message',
      valueString: isValid
        ? 'Concept mapping is valid'
        : `No valid mapping found for concept '${concept}' to target system`
    }
  ];

  if (isValid && matchingTarget) {
    parameters.push({
      name: 'target',
      valueCoding: {
        system: conceptMap.targetUri,
        code: matchingTarget.code,
        display: matchingTarget.display
      }
    });

    parameters.push({
      name: 'equivalence',
      valueCode: matchingTarget.equivalence
    });
  }

  res.json({
    resourceType: 'Parameters',
    parameter: parameters
  });
}));

/**
 * Helper function to create groups and elements recursively
 */
async function createGroupRecursive(conceptMapId, group) {
  const createdGroup = await prisma.conceptMapGroup.create({
    data: {
      source: group.source,
      target: group.target,
      conceptMapId
    }
  });

  if (group.element && Array.isArray(group.element)) {
    for (const element of group.element) {
      await createElementRecursive(createdGroup.id, element);
    }
  }

  return createdGroup;
}

/**
 * Helper function to create elements and targets
 */
async function createElementRecursive(groupId, element) {
  const createdElement = await prisma.conceptMapElement.create({
    data: {
      code: element.code,
      display: element.display,
      groupId
    }
  });

  if (element.target && Array.isArray(element.target)) {
    for (const target of element.target) {
      const createdTarget = await prisma.conceptMapTarget.create({
        data: {
          code: target.code,
          display: target.display,
          equivalence: target.equivalence || 'equivalent',
          comment: target.comment,
          elementId: createdElement.id
        }
      });

      // Create dependsOn if provided
      if (target.dependsOn && Array.isArray(target.dependsOn)) {
        for (const dep of target.dependsOn) {
          await prisma.conceptMapDependsOn.create({
            data: {
              property: dep.property,
              system: dep.system,
              value: dep.value,
              display: dep.display,
              targetId: createdTarget.id
            }
          });
        }
      }
    }
  }

  return createdElement;
}

module.exports = router;

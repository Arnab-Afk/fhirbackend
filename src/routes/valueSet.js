const express = require('express');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * GET /fhir/ValueSet - Search ValueSets
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

  const valueSets = await prisma.valueSet.findMany({
    where,
    take: parseInt(_count),
    skip: parseInt(_offset),
    orderBy: { updatedAt: 'desc' }
  });

  // Convert to FHIR Bundle
  const bundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: await prisma.valueSet.count({ where }),
    entry: valueSets.map(vs => ({
      resource: {
        resourceType: 'ValueSet',
        id: vs.id,
        url: vs.url,
        version: vs.version,
        name: vs.name,
        title: vs.title,
        status: vs.status,
        experimental: vs.experimental,
        date: vs.date?.toISOString(),
        publisher: vs.publisher,
        description: vs.description,
        compose: vs.compose,
        expansion: vs.expansion
      }
    }))
  };

  res.json(bundle);
}));

/**
 * GET /fhir/ValueSet/:id - Read ValueSet by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const valueSet = await prisma.valueSet.findUnique({
    where: { id }
  });

  if (!valueSet) {
    throw new NotFoundError('ValueSet', id);
  }

  // Convert to FHIR ValueSet
  const fhirValueSet = {
    resourceType: 'ValueSet',
    id: valueSet.id,
    url: valueSet.url,
    version: valueSet.version,
    name: valueSet.name,
    title: valueSet.title,
    status: valueSet.status,
    experimental: valueSet.experimental,
    date: valueSet.date?.toISOString(),
    publisher: valueSet.publisher,
    description: valueSet.description,
    compose: valueSet.compose,
    expansion: valueSet.expansion
  };

  res.json(fhirValueSet);
}));

/**
 * POST /fhir/ValueSet - Create ValueSet
 */
router.post('/', asyncHandler(async (req, res) => {
  const valueSetData = req.body;

  // Validate required fields
  if (!valueSetData.url) {
    throw new ValidationError('ValueSet.url is required');
  }

  // Check if ValueSet with this URL already exists
  const existing = await prisma.valueSet.findUnique({
    where: { url: valueSetData.url }
  });

  if (existing) {
    throw new ValidationError(`ValueSet with URL ${valueSetData.url} already exists`);
  }

  // Create ValueSet
  const valueSet = await prisma.valueSet.create({
    data: {
      url: valueSetData.url,
      version: valueSetData.version,
      name: valueSetData.name,
      title: valueSetData.title,
      status: valueSetData.status || 'active',
      experimental: valueSetData.experimental || false,
      date: valueSetData.date ? new Date(valueSetData.date) : new Date(),
      publisher: valueSetData.publisher,
      description: valueSetData.description,
      compose: valueSetData.compose || null,
      expansion: valueSetData.expansion || null
    }
  });

  // Return created ValueSet
  const fhirValueSet = {
    resourceType: 'ValueSet',
    id: valueSet.id,
    url: valueSet.url,
    version: valueSet.version,
    name: valueSet.name,
    title: valueSet.title,
    status: valueSet.status,
    experimental: valueSet.experimental,
    date: valueSet.date?.toISOString(),
    publisher: valueSet.publisher,
    description: valueSet.description,
    compose: valueSet.compose,
    expansion: valueSet.expansion
  };

  res.status(201).json(fhirValueSet);
}));

/**
 * PUT /fhir/ValueSet/:id - Update ValueSet
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const valueSetData = req.body;

  // Check if ValueSet exists
  const existing = await prisma.valueSet.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('ValueSet', id);
  }

  // Update ValueSet
  const updatedValueSet = await prisma.valueSet.update({
    where: { id },
    data: {
      version: valueSetData.version,
      name: valueSetData.name,
      title: valueSetData.title,
      status: valueSetData.status,
      experimental: valueSetData.experimental,
      date: valueSetData.date ? new Date(valueSetData.date) : new Date(),
      publisher: valueSetData.publisher,
      description: valueSetData.description,
      compose: valueSetData.compose,
      expansion: valueSetData.expansion
    }
  });

  const fhirValueSet = {
    resourceType: 'ValueSet',
    id: updatedValueSet.id,
    url: updatedValueSet.url,
    version: updatedValueSet.version,
    name: updatedValueSet.name,
    title: updatedValueSet.title,
    status: updatedValueSet.status,
    experimental: updatedValueSet.experimental,
    date: updatedValueSet.date?.toISOString(),
    publisher: updatedValueSet.publisher,
    description: updatedValueSet.description,
    compose: updatedValueSet.compose,
    expansion: updatedValueSet.expansion
  };

  res.json(fhirValueSet);
}));

/**
 * DELETE /fhir/ValueSet/:id - Delete ValueSet
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if ValueSet exists
  const existing = await prisma.valueSet.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('ValueSet', id);
  }

  // Delete ValueSet
  await prisma.valueSet.delete({
    where: { id }
  });

  res.status(204).send();
}));

/**
 * GET /fhir/ValueSet/:id/$expand - Expand ValueSet
 */
router.get('/:id/$expand', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { filter, count = 20, offset = 0 } = req.query;

  const valueSet = await prisma.valueSet.findUnique({
    where: { id }
  });

  if (!valueSet) {
    throw new NotFoundError('ValueSet', id);
  }

  let contains = [];

  // If compose rules exist, process them
  if (valueSet.compose) {
    const compose = typeof valueSet.compose === 'string' ? JSON.parse(valueSet.compose) : valueSet.compose;

    if (compose.include && Array.isArray(compose.include)) {
      for (const include of compose.include) {
        if (include.system) {
          // Find concepts from the specified CodeSystem
          const codeSystem = await prisma.codeSystem.findUnique({
            where: { url: include.system },
            include: {
              concepts: {
                where: include.concept ? {
                  code: { in: include.concept.map(c => c.code) }
                } : {},
                include: {
                  designations: true
                },
                take: parseInt(count),
                skip: parseInt(offset)
              }
            }
          });

          if (codeSystem) {
            contains = contains.concat(codeSystem.concepts.map(concept => ({
              system: codeSystem.url,
              code: concept.code,
              display: concept.display,
              designation: concept.designations.map(d => ({
                language: d.language,
                value: d.value
              }))
            })));
          }
        }
      }
    }
  }

  // Apply filter if provided
  if (filter) {
    contains = contains.filter(item =>
      item.display?.toLowerCase().includes(filter.toLowerCase()) ||
      item.code?.toLowerCase().includes(filter.toLowerCase())
    );
  }

  const expansion = {
    resourceType: 'ValueSet',
    id: valueSet.id,
    url: valueSet.url,
    version: valueSet.version,
    expansion: {
      timestamp: new Date().toISOString(),
      total: contains.length,
      contains: contains.slice(0, parseInt(count))
    }
  };

  res.json(expansion);
}));

/**
 * GET /fhir/ValueSet/:id/$validate-code - Validate code in ValueSet
 */
router.get('/:id/$validate-code', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, system, display, date, abstract } = req.query;

  if (!code) {
    throw new ValidationError('code parameter is required');
  }

  const valueSet = await prisma.valueSet.findUnique({
    where: { id }
  });

  if (!valueSet) {
    throw new NotFoundError('ValueSet', id);
  }

  let isValid = false;
  let foundConcept = null;

  // If compose rules exist, check them
  if (valueSet.compose) {
    const compose = typeof valueSet.compose === 'string' ? JSON.parse(valueSet.compose) : valueSet.compose;

    if (compose.include && Array.isArray(compose.include)) {
      for (const include of compose.include) {
        if (include.system && (!system || include.system === system)) {
          // Find concepts from the specified CodeSystem
          const codeSystem = await prisma.codeSystem.findUnique({
            where: { url: include.system },
            include: {
              concepts: {
                where: { code },
                include: {
                  designations: true
                }
              }
            }
          });

          if (codeSystem && codeSystem.concepts.length > 0) {
            isValid = true;
            foundConcept = codeSystem.concepts[0];
            break;
          }
        }
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
      name: 'code',
      valueCode: code
    }
  ];

  if (system) {
    parameters.push({
      name: 'system',
      valueUri: system
    });
  }

  if (isValid && foundConcept) {
    parameters.push({
      name: 'display',
      valueString: foundConcept.display
    });

    if (foundConcept.definition) {
      parameters.push({
        name: 'definition',
        valueString: foundConcept.definition
      });
    }

    // Check display match if provided
    if (display && foundConcept.display !== display) {
      parameters.push({
        name: 'message',
        valueString: `Display mismatch: expected '${foundConcept.display}', got '${display}'`
      });
    }
  } else {
    parameters.push({
      name: 'message',
      valueString: `Code '${code}' not found in ValueSet '${valueSet.name}'`
    });
  }

  res.json({
    resourceType: 'Parameters',
    parameter: parameters
  });
}));

module.exports = router;

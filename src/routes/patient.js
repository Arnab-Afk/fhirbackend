const express = require('express');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * GET /fhir/Patient - Search Patients
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    identifier,
    name,
    gender,
    birthdate,
    _count = 20,
    _offset = 0
  } = req.query;

  const where = {};

  if (identifier) where.identifiers = { some: { value: identifier } };
  if (gender) where.gender = gender;
  if (birthdate) where.birthDate = new Date(birthdate);

  const patients = await prisma.patient.findMany({
    where,
    include: {
      names: true,
      identifiers: true,
      _count: {
        select: { conditions: true }
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
    total: await prisma.patient.count({ where }),
    entry: patients.map(patient => ({
      resource: {
        resourceType: 'Patient',
        id: patient.id,
        active: patient.active,
        name: patient.names.map(name => ({
          use: name.use,
          family: name.family,
          given: name.given,
          prefix: name.prefix,
          suffix: name.suffix
        })),
        identifier: patient.identifiers.map(id => ({
          use: id.use,
          system: id.system,
          value: id.value
        })),
        gender: patient.gender,
        birthDate: patient.birthDate?.toISOString().split('T')[0]
      }
    }))
  };

  res.json(bundle);
}));

/**
 * GET /fhir/Patient/:id - Read Patient by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      names: true,
      identifiers: true,
      conditions: {
        take: 10,
        orderBy: { recordedDate: 'desc' }
      }
    }
  });

  if (!patient) {
    throw new NotFoundError('Patient', id);
  }

  // Convert to FHIR Patient
  const fhirPatient = {
    resourceType: 'Patient',
    id: patient.id,
    active: patient.active,
    name: patient.names.map(name => ({
      use: name.use,
      family: name.family,
      given: name.given,
      prefix: name.prefix,
      suffix: name.suffix
    })),
    identifier: patient.identifiers.map(id => ({
      use: id.use,
      system: id.system,
      value: id.value
    })),
    gender: patient.gender,
    birthDate: patient.birthDate?.toISOString().split('T')[0]
  };

  res.json(fhirPatient);
}));

/**
 * POST /fhir/Patient - Create Patient
 */
router.post('/', asyncHandler(async (req, res) => {
  const patientData = req.body;

  // Validate request body exists
  if (!patientData) {
    throw new ValidationError('Request body is required');
  }

  // Create Patient
  const patient = await prisma.patient.create({
    data: {
      active: patientData.active !== false,
      gender: patientData.gender || null,
      birthDate: patientData.birthDate ? new Date(patientData.birthDate) : null
    }
  });

  // Create names if provided
  if (patientData.name && Array.isArray(patientData.name)) {
    for (const name of patientData.name) {
      await prisma.patientName.create({
        data: {
          use: name.use,
          family: name.family,
          given: name.given || [],
          prefix: name.prefix || [],
          suffix: name.suffix || [],
          patientId: patient.id
        }
      });
    }
  }

  // Create identifiers if provided
  if (patientData.identifier && Array.isArray(patientData.identifier)) {
    for (const identifier of patientData.identifier) {
      await prisma.patientIdentifier.create({
        data: {
          use: identifier.use,
          system: identifier.system,
          value: identifier.value,
          patientId: patient.id
        }
      });
    }
  }

  // Return created Patient
  const createdPatient = await prisma.patient.findUnique({
    where: { id: patient.id },
    include: {
      names: true,
      identifiers: true
    }
  });

  const fhirPatient = {
    resourceType: 'Patient',
    id: createdPatient.id,
    active: createdPatient.active,
    name: createdPatient.names.map(name => ({
      use: name.use,
      family: name.family,
      given: name.given,
      prefix: name.prefix,
      suffix: name.suffix
    })),
    identifier: createdPatient.identifiers.map(id => ({
      use: id.use,
      system: id.system,
      value: id.value
    })),
    gender: createdPatient.gender,
    birthDate: createdPatient.birthDate?.toISOString().split('T')[0]
  };

  res.status(201).json(fhirPatient);
}));

/**
 * PUT /fhir/Patient/:id - Update Patient
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patientData = req.body;

  // Check if Patient exists
  const existing = await prisma.patient.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Patient', id);
  }

  // Update Patient
  const updatedPatient = await prisma.patient.update({
    where: { id },
    data: {
      active: patientData.active,
      gender: patientData.gender,
      birthDate: patientData.birthDate ? new Date(patientData.birthDate) : null
    },
    include: {
      names: true,
      identifiers: true
    }
  });

  const fhirPatient = {
    resourceType: 'Patient',
    id: updatedPatient.id,
    active: updatedPatient.active,
    name: updatedPatient.names.map(name => ({
      use: name.use,
      family: name.family,
      given: name.given,
      prefix: name.prefix,
      suffix: name.suffix
    })),
    identifier: updatedPatient.identifiers.map(id => ({
      use: id.use,
      system: id.system,
      value: id.value
    })),
    gender: updatedPatient.gender,
    birthDate: updatedPatient.birthDate?.toISOString().split('T')[0]
  };

  res.json(fhirPatient);
}));

/**
 * DELETE /fhir/Patient/:id - Delete Patient
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if Patient exists
  const existing = await prisma.patient.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Patient', id);
  }

  // Delete Patient (cascade will delete names, identifiers, conditions)
  await prisma.patient.delete({
    where: { id }
  });

  res.status(204).send();
}));

module.exports = router;

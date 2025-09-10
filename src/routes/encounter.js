const express = require('express');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * GET /fhir/Encounter - Search Encounters
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    patient,
    status,
    class: encounterClass,
    type,
    date,
    _count = 20,
    _offset = 0
  } = req.query;

  const where = {};

  if (patient) where.subjectId = patient;
  if (status) where.status = status;
  if (encounterClass) where.class = { path: '$.code', equals: encounterClass };
  if (type) where.type = { some: { path: '$.code', equals: type } };
  if (date) where.period = { path: '$.start', gte: new Date(date) };

  const encounters = await prisma.encounter.findMany({
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
    orderBy: { period: { start: 'desc' } }
  });

  // Convert to FHIR Bundle
  const bundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: await prisma.encounter.count({ where }),
    entry: encounters.map(encounter => ({
      resource: {
        resourceType: 'Encounter',
        id: encounter.id,
        status: encounter.status,
        class: encounter.class,
        type: encounter.type,
        subject: {
          reference: `Patient/${encounter.subjectId}`,
          display: encounter.subject.names[0]?.family ?
            `${encounter.subject.names[0].given.join(' ')} ${encounter.subject.names[0].family}` :
            'Unknown Patient'
        },
        period: encounter.period,
        serviceType: encounter.serviceType,
        priority: encounter.priority,
        diagnosis: encounter.diagnosis,
        hospitalization: encounter.hospitalization,
        location: encounter.location
      }
    }))
  };

  res.json(bundle);
}));

/**
 * GET /fhir/Encounter/:id - Read Encounter by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const encounter = await prisma.encounter.findUnique({
    where: { id },
    include: {
      subject: {
        include: {
          names: true,
          identifiers: true
        }
      }
    }
  });

  if (!encounter) {
    throw new NotFoundError('Encounter', id);
  }

  // Convert to FHIR Encounter
  const fhirEncounter = {
    resourceType: 'Encounter',
    id: encounter.id,
    status: encounter.status,
    class: encounter.class,
    type: encounter.type,
    subject: {
      reference: `Patient/${encounter.subjectId}`,
      display: encounter.subject.names[0]?.family ?
        `${encounter.subject.names[0].given.join(' ')} ${encounter.subject.names[0].family}` :
        'Unknown Patient'
    },
    period: encounter.period,
    serviceType: encounter.serviceType,
    priority: encounter.priority,
    diagnosis: encounter.diagnosis,
    hospitalization: encounter.hospitalization,
    location: encounter.location
  };

  res.json(fhirEncounter);
}));

/**
 * POST /fhir/Encounter - Create Encounter
 */
router.post('/', asyncHandler(async (req, res) => {
  const encounterData = req.body;

  // Validate required fields
  if (!encounterData.subject || !encounterData.subject.reference) {
    throw new ValidationError('Encounter.subject is required');
  }

  // Extract patient ID
  const patientId = encounterData.subject.reference.replace('Patient/', '');

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId }
  });

  if (!patient) {
    throw new NotFoundError('Patient', patientId);
  }

  // Create Encounter
  const encounter = await prisma.encounter.create({
    data: {
      status: encounterData.status || 'finished',
      class: encounterData.class || {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      type: encounterData.type || [],
      subjectId: patientId,
      period: encounterData.period || {
        start: new Date().toISOString(),
        end: new Date().toISOString()
      },
      serviceType: encounterData.serviceType,
      priority: encounterData.priority,
      diagnosis: encounterData.diagnosis || [],
      hospitalization: encounterData.hospitalization,
      location: encounterData.location || []
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

  // Convert to FHIR Encounter
  const fhirEncounter = {
    resourceType: 'Encounter',
    id: encounter.id,
    status: encounter.status,
    class: encounter.class,
    type: encounter.type,
    subject: {
      reference: `Patient/${encounter.subjectId}`,
      display: encounter.subject.names[0]?.family ?
        `${encounter.subject.names[0].given.join(' ')} ${encounter.subject.names[0].family}` :
        'Unknown Patient'
    },
    period: encounter.period,
    serviceType: encounter.serviceType,
    priority: encounter.priority,
    diagnosis: encounter.diagnosis,
    hospitalization: encounter.hospitalization,
    location: encounter.location
  };

  res.status(201).json(fhirEncounter);
}));

/**
 * PUT /fhir/Encounter/:id - Update Encounter
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const encounterData = req.body;

  // Check if Encounter exists
  const existing = await prisma.encounter.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Encounter', id);
  }

  // Extract patient ID if provided
  let patientId = existing.subjectId;
  if (encounterData.subject?.reference) {
    patientId = encounterData.subject.reference.replace('Patient/', '');
  }

  // Update Encounter
  const updatedEncounter = await prisma.encounter.update({
    where: { id },
    data: {
      status: encounterData.status,
      class: encounterData.class,
      type: encounterData.type,
      subjectId: patientId,
      period: encounterData.period,
      serviceType: encounterData.serviceType,
      priority: encounterData.priority,
      diagnosis: encounterData.diagnosis,
      hospitalization: encounterData.hospitalization,
      location: encounterData.location
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

  const fhirEncounter = {
    resourceType: 'Encounter',
    id: updatedEncounter.id,
    status: updatedEncounter.status,
    class: updatedEncounter.class,
    type: updatedEncounter.type,
    subject: {
      reference: `Patient/${updatedEncounter.subjectId}`,
      display: updatedEncounter.subject.names[0]?.family ?
        `${updatedEncounter.subject.names[0].given.join(' ')} ${updatedEncounter.subject.names[0].family}` :
        'Unknown Patient'
    },
    period: updatedEncounter.period,
    serviceType: updatedEncounter.serviceType,
    priority: updatedEncounter.priority,
    diagnosis: updatedEncounter.diagnosis,
    hospitalization: updatedEncounter.hospitalization,
    location: updatedEncounter.location
  };

  res.json(fhirEncounter);
}));

/**
 * DELETE /fhir/Encounter/:id - Delete Encounter
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if Encounter exists
  const existing = await prisma.encounter.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Encounter', id);
  }

  // Delete Encounter
  await prisma.encounter.delete({
    where: { id }
  });

  res.status(204).send();
}));

module.exports = router;

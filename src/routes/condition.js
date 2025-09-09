const express = require('express');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * GET /fhir/Condition - Search Conditions
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    patient,
    clinical_status,
    code,
    category,
    _count = 20,
    _offset = 0
  } = req.query;

  const where = {};

  if (patient) where.subjectId = patient;
  if (clinical_status) where.clinicalStatus = { path: '$.code', equals: clinical_status };
  if (code) where.code = { path: '$.code', equals: code };
  if (category) where.category = { some: { path: '$.code', equals: category } };

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
    total: await prisma.condition.count({ where }),
    entry: conditions.map(condition => ({
      resource: {
        resourceType: 'Condition',
        id: condition.id,
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
        encounter: condition.encounterId ? { reference: `Encounter/${condition.encounterId}` } : undefined,
        onsetDateTime: condition.onsetDateTime?.toISOString(),
        recordedDate: condition.recordedDate?.toISOString()
      }
    }))
  };

  res.json(bundle);
}));

/**
 * GET /fhir/Condition/:id - Read Condition by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const condition = await prisma.condition.findUnique({
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

  if (!condition) {
    throw new NotFoundError('Condition', id);
  }

  // Convert to FHIR Condition
  const fhirCondition = {
    resourceType: 'Condition',
    id: condition.id,
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
    encounter: condition.encounterId ? { reference: `Encounter/${condition.encounterId}` } : undefined,
    onsetDateTime: condition.onsetDateTime?.toISOString(),
    recordedDate: condition.recordedDate?.toISOString()
  };

  res.json(fhirCondition);
}));

/**
 * POST /fhir/Condition - Create Condition
 */
router.post('/', asyncHandler(async (req, res) => {
  const conditionData = req.body;

  // Validate required fields
  if (!conditionData.subject || !conditionData.subject.reference) {
    throw new ValidationError('Condition.subject is required');
  }

  if (!conditionData.code) {
    throw new ValidationError('Condition.code is required');
  }

  // Extract patient ID from reference
  const patientId = conditionData.subject.reference.replace('Patient/', '');

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId }
  });

  if (!patient) {
    throw new NotFoundError('Patient', patientId);
  }

  // Create Condition
  const condition = await prisma.condition.create({
    data: {
      clinicalStatus: conditionData.clinicalStatus,
      verificationStatus: conditionData.verificationStatus,
      category: conditionData.category || [],
      severity: conditionData.severity,
      code: conditionData.code,
      bodySite: conditionData.bodySite || [],
      subjectId: patientId,
      encounterId: conditionData.encounter?.reference?.replace('Encounter/', ''),
      onsetDateTime: conditionData.onsetDateTime ? new Date(conditionData.onsetDateTime) : null,
      recordedDate: conditionData.recordedDate ? new Date(conditionData.recordedDate) : new Date()
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

  // Convert to FHIR Condition
  const fhirCondition = {
    resourceType: 'Condition',
    id: condition.id,
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
    encounter: condition.encounterId ? { reference: `Encounter/${condition.encounterId}` } : undefined,
    onsetDateTime: condition.onsetDateTime?.toISOString(),
    recordedDate: condition.recordedDate?.toISOString()
  };

  res.status(201).json(fhirCondition);
}));

/**
 * PUT /fhir/Condition/:id - Update Condition
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conditionData = req.body;

  // Check if Condition exists
  const existing = await prisma.condition.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Condition', id);
  }

  // Extract patient ID from reference if provided
  let patientId = existing.subjectId;
  if (conditionData.subject?.reference) {
    patientId = conditionData.subject.reference.replace('Patient/', '');
  }

  // Update Condition
  const updatedCondition = await prisma.condition.update({
    where: { id },
    data: {
      clinicalStatus: conditionData.clinicalStatus,
      verificationStatus: conditionData.verificationStatus,
      category: conditionData.category,
      severity: conditionData.severity,
      code: conditionData.code,
      bodySite: conditionData.bodySite,
      subjectId: patientId,
      encounterId: conditionData.encounter?.reference?.replace('Encounter/', ''),
      onsetDateTime: conditionData.onsetDateTime ? new Date(conditionData.onsetDateTime) : null,
      recordedDate: conditionData.recordedDate ? new Date(conditionData.recordedDate) : new Date()
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

  const fhirCondition = {
    resourceType: 'Condition',
    id: updatedCondition.id,
    clinicalStatus: updatedCondition.clinicalStatus,
    verificationStatus: updatedCondition.verificationStatus,
    category: updatedCondition.category,
    severity: updatedCondition.severity,
    code: updatedCondition.code,
    bodySite: updatedCondition.bodySite,
    subject: {
      reference: `Patient/${updatedCondition.subjectId}`,
      display: updatedCondition.subject.names[0]?.family ?
        `${updatedCondition.subject.names[0].given.join(' ')} ${updatedCondition.subject.names[0].family}` :
        'Unknown Patient'
    },
    encounter: updatedCondition.encounterId ? { reference: `Encounter/${updatedCondition.encounterId}` } : undefined,
    onsetDateTime: updatedCondition.onsetDateTime?.toISOString(),
    recordedDate: updatedCondition.recordedDate?.toISOString()
  };

  res.json(fhirCondition);
}));

/**
 * DELETE /fhir/Condition/:id - Delete Condition
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if Condition exists
  const existing = await prisma.condition.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Condition', id);
  }

  // Delete Condition
  await prisma.condition.delete({
    where: { id }
  });

  res.status(204).send();
}));

module.exports = router;

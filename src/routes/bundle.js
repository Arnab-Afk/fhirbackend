const express = require('express');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { authenticateApiKey, authorizeAccess, auditLog } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * POST /fhir/Bundle - Process FHIR Bundle transactions
 * Supports transaction bundles for dual-coding with NAMASTE and ICD-11
 */
router.post('/', authenticateApiKey, authorizeAccess(['write']), auditLog('CREATE'), asyncHandler(async (req, res) => {
  const bundle = req.body;

  // Validate bundle structure
  if (!bundle || bundle.resourceType !== 'Bundle') {
    throw new ValidationError('Request body must be a FHIR Bundle');
  }

  if (bundle.type !== 'transaction') {
    throw new ValidationError('Only transaction bundles are supported');
  }

  if (!bundle.entry || !Array.isArray(bundle.entry)) {
    throw new ValidationError('Bundle must contain entries');
  }

  const results = [];
  const errors = [];

  // Process each entry in the bundle
  for (const entry of bundle.entry) {
    try {
      const result = await processBundleEntry(entry);
      results.push(result);
    } catch (error) {
      errors.push({
        entry: entry.request?.url || 'unknown',
        error: error.message
      });
    }
  }

  // Check if any entries failed
  if (errors.length > 0) {
    // Return error response with details
    return res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: errors.map(err => ({
        severity: 'error',
        code: 'processing',
        details: {
          text: `Failed to process ${err.entry}: ${err.error}`
        }
      }))
    });
  }

  // Return successful transaction response
  res.json({
    resourceType: 'Bundle',
    type: 'transaction-response',
    entry: results
  });
}));

/**
 * Process individual bundle entry
 */
async function processBundleEntry(entry) {
  const { resource, request } = entry;

  if (!request || !request.method) {
    throw new Error('Bundle entry must have a request with method');
  }

  switch (request.method.toUpperCase()) {
    case 'POST':
      return await handleCreate(resource, request.url);
    case 'PUT':
      return await handleUpdate(resource, request.url);
    case 'DELETE':
      return await handleDelete(request.url);
    default:
      throw new Error(`Unsupported HTTP method: ${request.method}`);
  }
}

/**
 * Handle POST operations in bundle
 */
async function handleCreate(resource, url) {
  const resourceType = url.split('/')[0];

  switch (resourceType) {
    case 'Condition':
      return await createCondition(resource);
    case 'Patient':
      return await createPatient(resource);
    case 'Encounter':
      return await createEncounter(resource);
    default:
      throw new Error(`Unsupported resource type for creation: ${resourceType}`);
  }
}

/**
 * Handle PUT operations in bundle
 */
async function handleUpdate(resource, url) {
  const parts = url.split('/');
  const resourceType = parts[0];
  const id = parts[1];

  switch (resourceType) {
    case 'Condition':
      return await updateCondition(id, resource);
    case 'Patient':
      return await updatePatient(id, resource);
    case 'Encounter':
      return await updateEncounter(id, resource);
    default:
      throw new Error(`Unsupported resource type for update: ${resourceType}`);
  }
}

/**
 * Handle DELETE operations in bundle
 */
async function handleDelete(url) {
  const parts = url.split('/');
  const resourceType = parts[0];
  const id = parts[1];

  switch (resourceType) {
    case 'Condition':
      return await deleteCondition(id);
    case 'Patient':
      return await deletePatient(id);
    case 'Encounter':
      return await deleteEncounter(id);
    default:
      throw new Error(`Unsupported resource type for deletion: ${resourceType}`);
  }
}

/**
 * Create Condition with dual-coding support
 */
async function createCondition(conditionData) {
  // Validate required fields
  if (!conditionData.subject || !conditionData.subject.reference) {
    throw new ValidationError('Condition.subject is required');
  }

  if (!conditionData.code || !conditionData.code.coding || !Array.isArray(conditionData.code.coding)) {
    throw new ValidationError('Condition.code.coding is required');
  }

  // Extract patient ID
  const patientId = conditionData.subject.reference.replace('Patient/', '');

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId }
  });

  if (!patient) {
    throw new ValidationError(`Patient ${patientId} not found`);
  }

  // Validate dual-coding: should have both NAMASTE and ICD-11 codes
  const namasteCoding = conditionData.code.coding.find(c =>
    c.system === 'https://ayush.gov.in/fhir/CodeSystem/namaste'
  );

  const icd11Coding = conditionData.code.coding.find(c =>
    c.system === 'http://id.who.int/icd/release/11/mms' ||
    c.system === 'http://id.who.int/icd/release/11/2022'
  );

  if (!namasteCoding) {
    throw new ValidationError('Condition must include NAMASTE coding for dual-coding');
  }

  if (!icd11Coding) {
    throw new ValidationError('Condition must include ICD-11 coding for dual-coding');
  }

  // Create Condition
  const condition = await prisma.condition.create({
    data: {
      clinicalStatus: conditionData.clinicalStatus || { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
      verificationStatus: conditionData.verificationStatus || { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
      category: conditionData.category || [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
      severity: conditionData.severity,
      code: conditionData.code,
      bodySite: conditionData.bodySite || [],
      subjectId: patientId,
      encounterId: conditionData.encounter?.reference?.replace('Encounter/', ''),
      onsetDateTime: conditionData.onsetDateTime ? new Date(conditionData.onsetDateTime) : null,
      recordedDate: conditionData.recordedDate ? new Date(conditionData.recordedDate) : new Date(),
      notes: conditionData.notes
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

  return {
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
    },
    status: '201'
  };
}

/**
 * Create Patient
 */
async function createPatient(patientData) {
  const patient = await prisma.patient.create({
    data: {
      active: patientData.active !== false,
      gender: patientData.gender,
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

  return {
    resource: {
      resourceType: 'Patient',
      id: patient.id,
      active: patient.active,
      name: patientData.name,
      identifier: patientData.identifier,
      gender: patient.gender,
      birthDate: patient.birthDate
    },
    status: '201'
  };
}

/**
 * Create Encounter
 */
async function createEncounter(encounterData) {
  // Validate required fields
  if (!encounterData.subject || !encounterData.subject.reference) {
    throw new ValidationError('Encounter.subject is required');
  }

  const patientId = encounterData.subject.reference.replace('Patient/', '');

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId }
  });

  if (!patient) {
    throw new ValidationError(`Patient ${patientId} not found`);
  }

  const encounter = await prisma.encounter.create({
    data: {
      status: encounterData.status || 'finished',
      class: encounterData.class || { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
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
    }
  });

  return {
    resource: {
      resourceType: 'Encounter',
      id: encounter.id,
      status: encounter.status,
      class: encounter.class,
      type: encounter.type,
      subject: { reference: `Patient/${encounter.subjectId}` },
      period: encounter.period,
      serviceType: encounter.serviceType,
      priority: encounter.priority,
      diagnosis: encounter.diagnosis,
      hospitalization: encounter.hospitalization,
      location: encounter.location
    },
    status: '201'
  };
}

/**
 * Update Condition
 */
async function updateCondition(id, conditionData) {
  const existing = await prisma.condition.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new ValidationError(`Condition ${id} not found`);
  }

  let patientId = existing.subjectId;
  if (conditionData.subject?.reference) {
    patientId = conditionData.subject.reference.replace('Patient/', '');
  }

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
      recordedDate: conditionData.recordedDate ? new Date(conditionData.recordedDate) : new Date(),
      notes: conditionData.notes
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

  return {
    resource: {
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
    },
    status: '200'
  };
}

/**
 * Update Patient
 */
async function updatePatient(id, patientData) {
  const existing = await prisma.patient.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new ValidationError(`Patient ${id} not found`);
  }

  const updatedPatient = await prisma.patient.update({
    where: { id },
    data: {
      active: patientData.active,
      gender: patientData.gender,
      birthDate: patientData.birthDate ? new Date(patientData.birthDate) : null
    }
  });

  return {
    resource: {
      resourceType: 'Patient',
      id: updatedPatient.id,
      active: updatedPatient.active,
      name: patientData.name,
      identifier: patientData.identifier,
      gender: updatedPatient.gender,
      birthDate: updatedPatient.birthDate
    },
    status: '200'
  };
}

/**
 * Update Encounter
 */
async function updateEncounter(id, encounterData) {
  const existing = await prisma.encounter.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new ValidationError(`Encounter ${id} not found`);
  }

  let patientId = existing.subjectId;
  if (encounterData.subject?.reference) {
    patientId = encounterData.subject.reference.replace('Patient/', '');
  }

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
    }
  });

  return {
    resource: {
      resourceType: 'Encounter',
      id: updatedEncounter.id,
      status: updatedEncounter.status,
      class: updatedEncounter.class,
      type: updatedEncounter.type,
      subject: { reference: `Patient/${updatedEncounter.subjectId}` },
      period: updatedEncounter.period,
      serviceType: updatedEncounter.serviceType,
      priority: updatedEncounter.priority,
      diagnosis: updatedEncounter.diagnosis,
      hospitalization: updatedEncounter.hospitalization,
      location: updatedEncounter.location
    },
    status: '200'
  };
}

/**
 * Delete Condition
 */
async function deleteCondition(id) {
  const existing = await prisma.condition.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new ValidationError(`Condition ${id} not found`);
  }

  await prisma.condition.delete({
    where: { id }
  });

  return {
    status: '204'
  };
}

/**
 * Delete Patient
 */
async function deletePatient(id) {
  const existing = await prisma.patient.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new ValidationError(`Patient ${id} not found`);
  }

  await prisma.patient.delete({
    where: { id }
  });

  return {
    status: '204'
  };
}

/**
 * Delete Encounter
 */
async function deleteEncounter(id) {
  const existing = await prisma.encounter.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new ValidationError(`Encounter ${id} not found`);
  }

  await prisma.encounter.delete({
    where: { id }
  });

  return {
    status: '204'
  };
}

module.exports = router;

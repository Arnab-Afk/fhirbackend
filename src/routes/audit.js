const express = require('express');
const { asyncHandler, NotFoundError } = require('../middleware/errorHandler');
const { validateFHIRRequest } = require('../middleware/requestLogger');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Apply FHIR validation to all routes
router.use(validateFHIRRequest);

/**
 * GET /fhir/AuditEvent - Search AuditEvents
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    date,
    type,
    action,
    agent,
    entity,
    _count = 20,
    _offset = 0
  } = req.query;

  const where = {};

  if (date) where.recorded = { gte: new Date(date) };
  if (type) where.type = { path: '$.code', equals: type };
  if (action) where.action = action;
  if (agent) where.agent = { path: '$.name', string_contains: agent };

  const auditEvents = await prisma.auditEvent.findMany({
    where,
    take: parseInt(_count),
    skip: parseInt(_offset),
    orderBy: { recorded: 'desc' }
  });

  // Convert to FHIR Bundle
  const bundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: await prisma.auditEvent.count({ where }),
    entry: auditEvents.map(event => ({
      resource: {
        resourceType: 'AuditEvent',
        id: event.id,
        type: event.type,
        subtype: event.subtype,
        action: event.action,
        recorded: event.recorded.toISOString(),
        outcome: event.outcome,
        outcomeDesc: event.outcomeDesc,
        purposeOfEvent: event.purposeOfEvent,
        agent: event.agent,
        source: event.source,
        entity: event.entity
      }
    }))
  };

  res.json(bundle);
}));

/**
 * GET /fhir/AuditEvent/:id - Read AuditEvent by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const auditEvent = await prisma.auditEvent.findUnique({
    where: { id }
  });

  if (!auditEvent) {
    throw new NotFoundError('AuditEvent', id);
  }

  // Convert to FHIR AuditEvent
  const fhirAuditEvent = {
    resourceType: 'AuditEvent',
    id: auditEvent.id,
    type: auditEvent.type,
    subtype: auditEvent.subtype,
    action: auditEvent.action,
    recorded: auditEvent.recorded.toISOString(),
    outcome: auditEvent.outcome,
    outcomeDesc: auditEvent.outcomeDesc,
    purposeOfEvent: auditEvent.purposeOfEvent,
    agent: auditEvent.agent,
    source: auditEvent.source,
    entity: auditEvent.entity
  };

  res.json(fhirAuditEvent);
}));

/**
 * POST /fhir/AuditEvent - Create AuditEvent
 */
router.post('/', asyncHandler(async (req, res) => {
  const auditEventData = req.body;

  // Create AuditEvent
  const auditEvent = await prisma.auditEvent.create({
    data: {
      type: auditEventData.type,
      subtype: auditEventData.subtype || [],
      action: auditEventData.action,
      recorded: auditEventData.recorded ? new Date(auditEventData.recorded) : new Date(),
      outcome: auditEventData.outcome,
      outcomeDesc: auditEventData.outcomeDesc,
      purposeOfEvent: auditEventData.purposeOfEvent || [],
      agent: auditEventData.agent || [],
      source: auditEventData.source,
      entity: auditEventData.entity || [],
      details: auditEventData.details
    }
  });

  // Convert to FHIR AuditEvent
  const fhirAuditEvent = {
    resourceType: 'AuditEvent',
    id: auditEvent.id,
    type: auditEvent.type,
    subtype: auditEvent.subtype,
    action: auditEvent.action,
    recorded: auditEvent.recorded.toISOString(),
    outcome: auditEvent.outcome,
    outcomeDesc: auditEvent.outcomeDesc,
    purposeOfEvent: auditEvent.purposeOfEvent,
    agent: auditEvent.agent,
    source: auditEvent.source,
    entity: auditEvent.entity
  };

  res.status(201).json(fhirAuditEvent);
}));

/**
 * DELETE /fhir/AuditEvent/:id - Delete AuditEvent (admin only)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if AuditEvent exists
  const existing = await prisma.auditEvent.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('AuditEvent', id);
  }

  // Delete AuditEvent
  await prisma.auditEvent.delete({
    where: { id }
  });

  res.status(204).send();
}));

/**
 * Helper function to create audit event
 */
const createAuditEvent = async (eventData) => {
  return await prisma.auditEvent.create({
    data: {
      type: eventData.type || {
        system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
        code: 'rest',
        display: 'Restful Operation'
      },
      subtype: eventData.subtype || [{
        system: 'http://hl7.org/fhir/restful-interaction',
        code: eventData.action || 'create',
        display: eventData.action || 'create'
      }],
      action: eventData.action || 'C',
      recorded: new Date(),
      outcome: eventData.outcome || '0',
      outcomeDesc: eventData.outcomeDesc,
      purposeOfEvent: eventData.purposeOfEvent || [],
      agent: eventData.agent || [{
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/extra-security-role-type',
            code: 'humanuser',
            display: 'human user'
          }]
        },
        who: {
          identifier: {
            value: eventData.userId || 'system'
          }
        },
        requestor: true
      }],
      source: eventData.source || {
        site: 'AyushBridge FHIR Server',
        observer: {
          display: 'AyushBridge Terminology Service'
        },
        type: [{
          system: 'http://terminology.hl7.org/CodeSystem/security-source-type',
          code: '4',
          display: 'Application Server'
        }]
      },
      entity: eventData.entity || [],
      details: eventData.details
    }
  });
};

module.exports = {
  router,
  createAuditEvent
};

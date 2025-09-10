const jwt = require('jsonwebtoken');

/**
 * Simple JWT Authentication Middleware
 * Validates JWT tokens for API access
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'login',
          details: {
            text: 'Authorization token required'
          }
        }]
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');

    // Attach user context to request
    req.user = {
      id: decoded.userId,
      name: decoded.name,
      role: decoded.role || 'practitioner',
      permissions: decoded.permissions || []
    };

    // Add user context to request for audit logging
    req.userContext = {
      userId: decoded.userId,
      userName: decoded.name,
      userRole: decoded.role,
      sessionId: req.headers['x-session-id'] || 'unknown'
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);

    return res.status(401).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'login',
        details: {
          text: 'Invalid or expired token'
        }
      }]
    });
  }
};

/**
 * API Key Authentication Middleware
 * Alternative authentication using API keys
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'login',
        details: {
          text: 'API key required'
        }
      }]
    });
  }

  // In production, validate against a database of API keys
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : ['default-api-key'];

  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'login',
        details: {
          text: 'Invalid API key'
        }
      }]
    });
  }

  // Attach user context to request
  req.user = {
    id: 'api-user',
    name: 'API User',
    role: 'system',
    permissions: ['read', 'write']
  };

  req.userContext = {
    userId: 'api-user',
    userName: 'API User',
    userRole: 'system',
    sessionId: req.headers['x-session-id'] || 'unknown'
  };

  next();
};

/**
 * Authorization middleware for resource access
 * Checks user permissions for specific operations
 */
const authorizeAccess = (requiredPermissions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'login',
          details: {
            text: 'Authentication required'
          }
        }]
      });
    }

    // Check if user has required permissions
    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.length === 0 ||
      requiredPermissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'forbidden',
          details: {
            text: 'Insufficient permissions'
          }
        }]
      });
    }

    next();
  };
};

/**
 * Audit logging middleware
 * Logs all FHIR operations for compliance
 */
const auditLog = (operation) => {
  return async (req, res, next) => {
    const startTime = Date.now();

    // Store original response methods
    const originalJson = res.json;
    const originalSend = res.send;
    const originalStatus = res.status;

    let responseData = null;
    let statusCode = 200;

    // Override response methods to capture data
    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };

    res.send = function(data) {
      responseData = data;
      return originalSend.call(this, data);
    };

    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Continue with request processing
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        const userContext = req.userContext || {
          userId: 'anonymous',
          userName: 'Anonymous User',
          userRole: 'unknown',
          sessionId: 'unknown'
        };

        // Create audit event
        const auditEvent = {
          type: {
            system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
            code: 'rest',
            display: 'Restful Operation'
          },
          subtype: [{
            system: 'http://hl7.org/fhir/restful-interaction',
            code: operation,
            display: operation
          }],
          action: getActionFromMethod(req.method),
          recorded: new Date(),
          outcome: statusCode >= 400 ? '4' : '0',
          outcomeDesc: statusCode >= 400 ? 'Operation failed' : 'Operation successful',
          agent: [{
            type: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/extra-security-role-type',
                code: 'humanuser',
                display: 'human user'
              }]
            },
            who: {
              identifier: {
                value: userContext.userId
              },
              display: userContext.userName
            },
            requestor: true,
            role: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
                code: userContext.userRole,
                display: userContext.userRole
              }]
            }]
          }],
          source: {
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
          entity: [{
            what: {
              reference: `${req.baseUrl}${req.path}`
            },
            type: {
              system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
              code: '2',
              display: 'System Object'
            },
            role: {
              system: 'http://terminology.hl7.org/CodeSystem/object-role',
              code: '4',
              display: 'Domain Resource'
            },
            lifecycle: {
              system: 'http://terminology.hl7.org/CodeSystem/dicom-audit-lifecycle',
              code: '6',
              display: 'Access / Use'
            },
            name: req.originalUrl,
            description: `FHIR ${operation} operation`
          }]
        };

        // Add request details for sensitive operations
        if (['CREATE', 'UPDATE', 'DELETE'].includes(operation)) {
          auditEvent.entity[0].detail = [{
            type: 'Request Body',
            valueBase64Binary: Buffer.from(JSON.stringify(req.body)).toString('base64')
          }];
        }

        // Log audit event (you can replace this with database logging)
        console.log(`AUDIT: ${userContext.userId} performed ${operation} on ${req.originalUrl} - Status: ${statusCode} - Duration: ${duration}ms`);

        // TODO: Save audit event to database
        // await saveAuditEvent(auditEvent);

      } catch (error) {
        console.error('Audit logging error:', error);
      }
    });

    next();
  };
};

/**
 * Helper function to map HTTP method to audit action
 */
function getActionFromMethod(method) {
  switch (method.toUpperCase()) {
    case 'POST': return 'C';
    case 'PUT': return 'U';
    case 'DELETE': return 'D';
    case 'GET':
    case 'HEAD': return 'R';
    default: return 'E';
  }
}

/**
 * Consent validation middleware
 * Ensures user has provided consent for data processing
 */
const validateConsent = (req, res, next) => {
  const consentHeader = req.headers['x-consent-token'];

  if (!consentHeader) {
    return res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'required',
        details: {
          text: 'Consent token required for this operation'
        }
      }]
    });
  }

  // TODO: Validate consent token with consent management service
  // For now, just check if it's present

  next();
};

module.exports = {
  authenticateToken,
  authenticateApiKey,
  authorizeAccess,
  auditLog,
  validateConsent
};
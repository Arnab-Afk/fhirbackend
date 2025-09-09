const { PrismaClientKnownRequestError } = require('@prisma/client/runtime/library');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error response
  let statusCode = 500;
  let errorCode = 'internal-server-error';
  let errorMessage = 'Internal server error';

  // Handle Prisma errors
  if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        errorCode = 'duplicate-key';
        errorMessage = 'Resource already exists';
        break;
      case 'P2025':
        statusCode = 404;
        errorCode = 'not-found';
        errorMessage = 'Resource not found';
        break;
      default:
        statusCode = 400;
        errorCode = 'database-error';
        errorMessage = 'Database operation failed';
    }
  }

  // Handle validation errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'validation-error';
    errorMessage = err.message;
  }

  // Handle FHIR-specific errors
  else if (err.code === 'FHIR_VALIDATION_ERROR') {
    statusCode = 400;
    errorCode = 'fhir-validation-error';
    errorMessage = err.message;
  }

  // Handle other known errors
  else if (err.statusCode) {
    statusCode = err.statusCode;
    errorCode = err.code || 'unknown-error';
    errorMessage = err.message;
  }

  // Return FHIR OperationOutcome
  res.status(statusCode).json({
    resourceType: 'OperationOutcome',
    issue: [{
      severity: 'error',
      code: errorCode,
      details: {
        text: errorMessage
      },
      diagnostics: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }]
  });
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * FHIR validation error class
 */
class FHIRValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FHIRValidationError';
    this.code = 'FHIR_VALIDATION_ERROR';
    this.statusCode = 400;
  }
}

/**
 * Not found error class
 */
class NotFoundError extends Error {
  constructor(resourceType, id) {
    super(`${resourceType}/${id} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'not-found';
  }
}

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'validation-error';
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  FHIRValidationError,
  NotFoundError,
  ValidationError
};

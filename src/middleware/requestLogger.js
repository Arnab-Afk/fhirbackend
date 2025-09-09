/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusColor = statusCode >= 400 ? '\x1b[31m' : statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
    const resetColor = '\x1b[0m';

    console.log(
      `[${new Date().toISOString()}] ${statusColor}${req.method} ${req.originalUrl} ${statusCode}${resetColor} - ${duration}ms`
    );
  });

  next();
};

/**
 * FHIR request validation middleware
 */
const validateFHIRRequest = (req, res, next) => {
  // Check Accept header for FHIR content
  const accept = req.get('Accept');
  if (accept && !accept.includes('application/fhir+json') && !accept.includes('application/json')) {
    return res.status(406).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'not-acceptable',
        details: {
          text: 'Accept header must include application/fhir+json or application/json'
        }
      }]
    });
  }

  // Check Content-Type for POST/PUT requests
  if (['POST', 'PUT'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || (!contentType.includes('application/fhir+json') && !contentType.includes('application/json'))) {
      return res.status(415).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'unsupported-media-type',
          details: {
            text: 'Content-Type must be application/fhir+json or application/json'
          }
        }]
      });
    }
  }

  next();
};

/**
 * Rate limiting middleware (simple in-memory implementation)
 */
const rateLimitStore = new Map();

const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create rate limit data for this IP
    let rateData = rateLimitStore.get(key);
    if (!rateData) {
      rateData = { requests: [], windowStart: now };
      rateLimitStore.set(key, rateData);
    }

    // Clean old requests
    rateData.requests = rateData.requests.filter(time => time > windowStart);

    // Check if limit exceeded
    if (rateData.requests.length >= maxRequests) {
      return res.status(429).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'throttled',
          details: {
            text: 'Too many requests. Please try again later.'
          }
        }]
      });
    }

    // Add current request
    rateData.requests.push(now);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [ip, data] of rateLimitStore.entries()) {
        if (data.requests.length === 0 && now - data.windowStart > windowMs * 2) {
          rateLimitStore.delete(ip);
        }
      }
    }

    next();
  };
};

module.exports = {
  requestLogger,
  validateFHIRRequest,
  rateLimit
};

const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for testing
 */
function generateTestToken() {
  const payload = {
    userId: 'test-user-123',
    name: 'Test User',
    role: 'practitioner',
    permissions: ['read', 'write'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  const secret = process.env.JWT_SECRET || 'default-secret-key';
  const token = jwt.sign(payload, secret);

  console.log('🔑 Generated JWT Token:');
  console.log(token);
  console.log('\n📋 Use this token in the Authorization header:');
  console.log(`Authorization: Bearer ${token}`);

  return token;
}

// Generate token if this script is executed directly
if (require.main === module) {
  generateTestToken();
}

module.exports = { generateTestToken };

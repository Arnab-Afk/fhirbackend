const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/fhir';
const RESULTS_DIR = path.join(__dirname, '..', 'test-results');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Test results storage
const testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  },
  details: {}
};

// Helper function to save response
function saveResponse(testName, response, isError = false) {
  const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  const filepath = path.join(RESULTS_DIR, filename);

  const data = {
    testName,
    timestamp: new Date().toISOString(),
    status: isError ? 'error' : 'success',
    response: response
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

// Helper function to log test result
function logTest(testName, success, error = null) {
  testResults.summary.total++;
  if (success) {
    testResults.summary.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.summary.failed++;
    console.log(`❌ ${testName}`);
    if (error) {
      testResults.summary.errors.push({ testName, error: error.message });
    }
  }

  testResults.details[testName] = {
    success,
    error: error ? error.message : null,
    timestamp: new Date().toISOString()
  };
}

// Test CodeSystem endpoints
async function testCodeSystemEndpoints() {
  console.log('\n🧪 Testing CodeSystem Endpoints...');

  try {
    // Test search
    const searchResponse = await axios.get(`${BASE_URL}/CodeSystem`, {
      headers: { 'Accept': 'application/json' }
    });
    saveResponse('CodeSystem_Search', searchResponse.data);
    logTest('CodeSystem Search', searchResponse.status === 200);

    if (searchResponse.data.entry && searchResponse.data.entry.length > 0) {
      const codeSystemId = searchResponse.data.entry[0].resource.id;

      // Test read
      const readResponse = await axios.get(`${BASE_URL}/CodeSystem/${codeSystemId}`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('CodeSystem_Read', readResponse.data);
      logTest('CodeSystem Read', readResponse.status === 200);

      // Test $lookup
      const lookupResponse = await axios.post(`${BASE_URL}/CodeSystem/${codeSystemId}/$lookup`, {
        parameter: [{ name: 'code', valueCode: 'TM26.0' }]
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      saveResponse('CodeSystem_$lookup', lookupResponse.data);
      logTest('CodeSystem $lookup', lookupResponse.status === 200);

      // Test $validate-code
      const validateCodeResponse = await axios.post(`${BASE_URL}/CodeSystem/${codeSystemId}/$validate-code`, {
        parameter: [{ name: 'code', valueCode: 'TM26.0' }]
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      saveResponse('CodeSystem_$validate-code', validateCodeResponse.data);
      logTest('CodeSystem $validate-code', validateCodeResponse.status === 200);
    }
  } catch (error) {
    saveResponse('CodeSystem_Error', error.response?.data || error.message, true);
    logTest('CodeSystem Tests', false, error);
  }
}

// Test ConceptMap endpoints
async function testConceptMapEndpoints() {
  console.log('\n🧪 Testing ConceptMap Endpoints...');

  try {
    // Test search
    const searchResponse = await axios.get(`${BASE_URL}/ConceptMap`, {
      headers: { 'Accept': 'application/json' }
    });
    saveResponse('ConceptMap_Search', searchResponse.data);
    logTest('ConceptMap Search', searchResponse.status === 200);

    if (searchResponse.data.entry && searchResponse.data.entry.length > 0) {
      const conceptMapId = searchResponse.data.entry[0].resource.id;

      // Test read
      const readResponse = await axios.get(`${BASE_URL}/ConceptMap/${conceptMapId}`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('ConceptMap_Read', readResponse.data);
      logTest('ConceptMap Read', readResponse.status === 200);

      // Test $translate
      const translateResponse = await axios.post(`${BASE_URL}/ConceptMap/${conceptMapId}/$translate`, {
        parameter: [
          { name: 'code', valueCode: 'SR11' },
          { name: 'system', valueUri: 'https://ayush.gov.in/fhir/CodeSystem/namaste' }
        ]
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      saveResponse('ConceptMap_$translate', translateResponse.data);
      logTest('ConceptMap $translate', translateResponse.status === 200);

      // Test $validate
      const validateResponse = await axios.post(`${BASE_URL}/ConceptMap/${conceptMapId}/$validate`, {
        parameter: [
          { name: 'source', valueUri: 'https://ayush.gov.in/fhir/CodeSystem/namaste' },
          { name: 'target', valueUri: 'http://id.who.int/icd/release/11/mms' },
          { name: 'concept', valueCoding: { code: 'SR11', system: 'https://ayush.gov.in/fhir/CodeSystem/namaste' } }
        ]
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      saveResponse('ConceptMap_$validate', validateResponse.data);
      logTest('ConceptMap $validate', validateResponse.status === 200);
    }
  } catch (error) {
    saveResponse('ConceptMap_Error', error.response?.data || error.message, true);
    logTest('ConceptMap Tests', false, error);
  }
}

// Test ValueSet endpoints
async function testValueSetEndpoints() {
  console.log('\n🧪 Testing ValueSet Endpoints...');

  try {
    // Test search
    const searchResponse = await axios.get(`${BASE_URL}/ValueSet`, {
      headers: { 'Accept': 'application/json' }
    });
    saveResponse('ValueSet_Search', searchResponse.data);
    logTest('ValueSet Search', searchResponse.status === 200);

    if (searchResponse.data.entry && searchResponse.data.entry.length > 0) {
      const valueSetId = searchResponse.data.entry[0].resource.id;

      // Test read
      const readResponse = await axios.get(`${BASE_URL}/ValueSet/${valueSetId}`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('ValueSet_Read', readResponse.data);
      logTest('ValueSet Read', readResponse.status === 200);

      // Test $expand
      const expandResponse = await axios.get(`${BASE_URL}/ValueSet/${valueSetId}/$expand`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('ValueSet_$expand', expandResponse.data);
      logTest('ValueSet $expand', expandResponse.status === 200);

      // Test $validate-code
      const validateCodeResponse = await axios.get(`${BASE_URL}/ValueSet/${valueSetId}/$validate-code?code=TM26.0`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('ValueSet_$validate-code', validateCodeResponse.data);
      logTest('ValueSet $validate-code', validateCodeResponse.status === 200);
    }
  } catch (error) {
    saveResponse('ValueSet_Error', error.response?.data || error.message, true);
    logTest('ValueSet Tests', false, error);
  }
}

// Test Condition endpoints
async function testConditionEndpoints() {
  console.log('\n🧪 Testing Condition Endpoints...');

  try {
    // Test search
    const searchResponse = await axios.get(`${BASE_URL}/Condition`, {
      headers: { 'Accept': 'application/json' }
    });
    saveResponse('Condition_Search', searchResponse.data);
    logTest('Condition Search', searchResponse.status === 200);

    if (searchResponse.data.entry && searchResponse.data.entry.length > 0) {
      const conditionId = searchResponse.data.entry[0].resource.id;

      // Test read
      const readResponse = await axios.get(`${BASE_URL}/Condition/${conditionId}`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('Condition_Read', readResponse.data);
      logTest('Condition Read', readResponse.status === 200);
    }
  } catch (error) {
    saveResponse('Condition_Error', error.response?.data || error.message, true);
    logTest('Condition Tests', false, error);
  }
}

// Test Patient endpoints
async function testPatientEndpoints() {
  console.log('\n🧪 Testing Patient Endpoints...');

  try {
    // Test search
    const searchResponse = await axios.get(`${BASE_URL}/Patient`, {
      headers: { 'Accept': 'application/json' }
    });
    saveResponse('Patient_Search', searchResponse.data);
    logTest('Patient Search', searchResponse.status === 200);

    if (searchResponse.data.entry && searchResponse.data.entry.length > 0) {
      const patientId = searchResponse.data.entry[0].resource.id;

      // Test read
      const readResponse = await axios.get(`${BASE_URL}/Patient/${patientId}`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('Patient_Read', readResponse.data);
      logTest('Patient Read', readResponse.status === 200);
    }
  } catch (error) {
    saveResponse('Patient_Error', error.response?.data || error.message, true);
    logTest('Patient Tests', false, error);
  }
}

// Test Bundle endpoints
async function testBundleEndpoints() {
  console.log('\n🧪 Testing Bundle Endpoints...');

  try {
    // Test transaction bundle POST
    const bundleData = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            active: true,
            name: [{
              use: 'official',
              family: 'Test',
              given: ['Patient']
            }],
            gender: 'male',
            birthDate: '1990-01-01'
          },
          request: {
            method: 'POST',
            url: 'Patient'
          }
        }
      ]
    };

    const response = await axios.post(`${BASE_URL}/Bundle`, bundleData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    saveResponse('Bundle_Transaction', response.data);
    logTest('Bundle Transaction', response.status === 200);
  } catch (error) {
    saveResponse('Bundle_Error', error.response?.data || error.message, true);
    logTest('Bundle Tests', false, error);
  }
}

// Test Encounter endpoints
async function testEncounterEndpoints() {
  console.log('\n🧪 Testing Encounter Endpoints...');

  try {
    // Test search
    const searchResponse = await axios.get(`${BASE_URL}/Encounter`, {
      headers: { 'Accept': 'application/json' }
    });
    saveResponse('Encounter_Search', searchResponse.data);
    logTest('Encounter Search', searchResponse.status === 200);

    if (searchResponse.data.entry && searchResponse.data.entry.length > 0) {
      const encounterId = searchResponse.data.entry[0].resource.id;

      // Test read
      const readResponse = await axios.get(`${BASE_URL}/Encounter/${encounterId}`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('Encounter_Read', readResponse.data);
      logTest('Encounter Read', readResponse.status === 200);
    }
  } catch (error) {
    saveResponse('Encounter_Error', error.response?.data || error.message, true);
    logTest('Encounter Tests', false, error);
  }
}

// Test health endpoint
async function testHealthEndpoint() {
  console.log('\n🧪 Testing Health Endpoint...');

  try {
    const response = await axios.get('http://localhost:3000/health');
    saveResponse('Health_Check', response.data);
    logTest('Health Check', response.status === 200);
  } catch (error) {
    saveResponse('Health_Error', error.response?.data || error.message, true);
    logTest('Health Check', false, error);
  }
}

// Test AuditEvent endpoints
async function testAuditEventEndpoints() {
  console.log('\n🧪 Testing AuditEvent Endpoints...');

  try {
    // Test search
    const searchResponse = await axios.get(`${BASE_URL}/AuditEvent`, {
      headers: { 'Accept': 'application/json' }
    });
    saveResponse('AuditEvent_Search', searchResponse.data);
    logTest('AuditEvent Search', searchResponse.status === 200);

    if (searchResponse.data.entry && searchResponse.data.entry.length > 0) {
      const auditEventId = searchResponse.data.entry[0].resource.id;

      // Test read
      const readResponse = await axios.get(`${BASE_URL}/AuditEvent/${auditEventId}`, {
        headers: { 'Accept': 'application/json' }
      });
      saveResponse('AuditEvent_Read', readResponse.data);
      logTest('AuditEvent Read', readResponse.status === 200);
    }
  } catch (error) {
    saveResponse('AuditEvent_Error', error.response?.data || error.message, true);
    logTest('AuditEvent Tests', false, error);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting FHIR Backend API Tests...\n');

  await testHealthEndpoint();
  await testCapabilityStatement();
  await testCodeSystemEndpoints();
  await testConceptMapEndpoints();
  await testValueSetEndpoints();
  await testConditionEndpoints();
  await testPatientEndpoints();
  await testEncounterEndpoints();
  await testBundleEndpoints();
  await testAuditEventEndpoints();

  // Save test summary
  const summaryPath = path.join(RESULTS_DIR, 'test-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(testResults, null, 2));

  console.log('\n📊 Test Summary:');
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`Passed: ${testResults.summary.passed}`);
  console.log(`Failed: ${testResults.summary.failed}`);
  console.log(`\n📁 Results saved to: ${RESULTS_DIR}`);

  if (testResults.summary.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.summary.errors.forEach(error => {
      console.log(`- ${error.testName}: ${error.error}`);
    });
  }

  console.log('\n✅ Testing completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testCodeSystemEndpoints,
  testConceptMapEndpoints,
  testValueSetEndpoints,
  testConditionEndpoints,
  testPatientEndpoints,
  testEncounterEndpoints,
  testBundleEndpoints,
  testAuditEventEndpoints,
  testHealthEndpoint,
  testCapabilityStatement
};

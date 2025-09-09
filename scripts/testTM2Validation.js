const axios = require('axios');

async function testTM2Validation() {
  console.log('🧪 Testing TM2 Code Validation...\n');

  const tm2CodeSystemId = 'cmfcyyugq0007srbpohh1o7s9'; // ICD11-TM2 CodeSystem

  try {
    // Test $validate-code with TM26.0 in TM2 CodeSystem
    console.log('Testing TM26.0 validation in ICD11-TM2 CodeSystem...');
    const validateResponse = await axios.post(`http://localhost:3000/fhir/CodeSystem/${tm2CodeSystemId}/\$validate-code`, {
      parameter: [{ name: 'code', valueCode: 'TM26.0' }]
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ TM26.0 validation result:', JSON.stringify(validateResponse.data, null, 2));

    // Test $lookup with TM26.0 in TM2 CodeSystem
    console.log('\nTesting TM26.0 lookup in ICD11-TM2 CodeSystem...');
    const lookupResponse = await axios.post(`http://localhost:3000/fhir/CodeSystem/${tm2CodeSystemId}/\$lookup`, {
      parameter: [{ name: 'code', valueCode: 'TM26.0' }]
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ TM26.0 lookup result:', JSON.stringify(lookupResponse.data, null, 2));

    // Test ConceptMap $translate
    console.log('\nTesting ConceptMap translation (NAMASTE SR11 to ICD11-TM2)...');
    const translateResponse = await axios.post('http://localhost:3000/fhir/ConceptMap/cmfczxkcw0000pau5h8g5h76g/\$translate', {
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

    console.log('✅ Translation result:', JSON.stringify(translateResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run the test
testTM2Validation();

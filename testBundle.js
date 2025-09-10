const axios = require('axios');

const BASE_URL = 'http://localhost:3000/fhir';

// Test Bundle upload with dual-coded condition
async function testBundleUpload() {
  console.log('🧪 Testing FHIR Bundle Upload with Dual-Coding...\n');

  // First, create a patient
  const patientBundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [{
      resource: {
        resourceType: 'Patient',
        active: true,
        name: [{
          use: 'official',
          family: 'Sharma',
          given: ['Rajesh']
        }],
        gender: 'male',
        birthDate: '1980-01-01',
        identifier: [{
          use: 'official',
          system: 'https://abha.gov.in',
          value: '12-3456-7890-1234'
        }]
      },
      request: {
        method: 'POST',
        url: 'Patient'
      }
    }]
  };

  try {
    console.log('📝 Creating patient...');
    const patientResponse = await axios.post(`${BASE_URL}/Bundle`, patientBundle, {
      headers: { 'Content-Type': 'application/fhir+json' }
    });

    const patientId = patientResponse.data.entry[0].resource.id;
    console.log(`✅ Patient created with ID: ${patientId}`);

    // Now create a dual-coded condition
    const conditionBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [{
        resource: {
          resourceType: 'Condition',
          subject: {
            reference: `Patient/${patientId}`
          },
          code: {
            coding: [
              {
                system: 'https://ayush.gov.in/fhir/CodeSystem/namaste',
                code: 'NAM001',
                display: 'Amavata (Rheumatoid Arthritis)'
              },
              {
                system: 'http://id.who.int/icd/release/11/mms',
                code: 'TM26.0',
                display: 'Disorders of vata dosha'
              },
              {
                system: 'http://id.who.int/icd/release/11/2022',
                code: 'FA20.00',
                display: 'Rheumatoid arthritis, unspecified'
              }
            ]
          },
          clinicalStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }]
          },
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'problem-list-item'
            }]
          }],
          recordedDate: new Date().toISOString()
        },
        request: {
          method: 'POST',
          url: 'Condition'
        }
      }]
    };

    console.log('📝 Creating dual-coded condition...');
    const conditionResponse = await axios.post(`${BASE_URL}/Bundle`, conditionBundle, {
      headers: { 'Content-Type': 'application/fhir+json' }
    });

    const conditionId = conditionResponse.data.entry[0].resource.id;
    console.log(`✅ Dual-coded condition created with ID: ${conditionId}`);

    // Verify the condition was created with dual coding
    console.log('🔍 Verifying dual-coded condition...');
    const verifyResponse = await axios.get(`${BASE_URL}/Condition/${conditionId}`);
    const condition = verifyResponse.data;

    console.log('📋 Condition codes:');
    condition.code.coding.forEach((coding, index) => {
      console.log(`  ${index + 1}. ${coding.system} - ${coding.code}: ${coding.display}`);
    });

    console.log('\n✅ Bundle upload test completed successfully!');
    console.log('🎯 Dual-coding implemented: NAMASTE + ICD-11 TM2 + ICD-11 Biomedicine');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Test Encounter creation
async function testEncounterCreation() {
  console.log('\n🧪 Testing Encounter Creation...\n');

  // First get a patient
  try {
    const patientsResponse = await axios.get(`${BASE_URL}/Patient`);
    if (patientsResponse.data.entry && patientsResponse.data.entry.length > 0) {
      const patientId = patientsResponse.data.entry[0].resource.id;

      const encounterBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [{
          resource: {
            resourceType: 'Encounter',
            status: 'finished',
            class: {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'AMB',
              display: 'ambulatory'
            },
            type: [{
              coding: [{
                system: 'http://snomed.info/sct',
                code: '185317003',
                display: 'Ayurvedic encounter'
              }]
            }],
            subject: {
              reference: `Patient/${patientId}`
            },
            period: {
              start: new Date().toISOString(),
              end: new Date().toISOString()
            }
          },
          request: {
            method: 'POST',
            url: 'Encounter'
          }
        }]
      };

      console.log('📝 Creating encounter...');
      const encounterResponse = await axios.post(`${BASE_URL}/Bundle`, encounterBundle, {
        headers: { 'Content-Type': 'application/fhir+json' }
      });

      const encounterId = encounterResponse.data.entry[0].resource.id;
      console.log(`✅ Encounter created with ID: ${encounterId}`);

    } else {
      console.log('⚠️  No patients found, skipping encounter test');
    }
  } catch (error) {
    console.error('❌ Encounter test failed:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  await testBundleUpload();
  await testEncounterCreation();
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testBundleUpload,
  testEncounterCreation,
  runTests
};

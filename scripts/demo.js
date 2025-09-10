#!/usr/bin/env node

/**
 * Demo script for NAMASTE and ICD-11 integration
 * Shows auto-complete, translation, and dual-coding capabilities
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/fhir';
const API_KEY = 'default-api-key'; // Use the default API key from env

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-API-Key': API_KEY,
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error calling ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

async function runDemo() {
  console.log('🚀 NAMASTE & ICD-11 Integration Demo\n');

  try {
    // 1. Test health endpoint
    console.log('1️⃣ Testing server health...');
    const health = await apiCall('GET', '/../health');
    console.log('✅ Server is healthy:', health.status);

    // 2. Test auto-complete for NAMASTE terms
    console.log('\n2️⃣ Testing auto-complete for "fever"...');
    const autoComplete = await apiCall('GET', '/terminology/$autocomplete?search=fever&limit=5');
    console.log(`✅ Found ${autoComplete.parameter.find(p => p.name === 'matches')?.valueInteger || 0} matches`);
    
    const matches = autoComplete.parameter.filter(p => p.name === 'match');
    if (matches.length > 0) {
      console.log('📋 Sample matches:');
      matches.slice(0, 3).forEach((match, i) => {
        const code = match.part.find(p => p.name === 'code')?.valueCoding;
        const terminology = match.part.find(p => p.name === 'terminology')?.valueString;
        console.log(`   ${i + 1}. [${terminology}] ${code?.code}: ${code?.display}`);
      });
    }

    // 3. Test CodeSystem lookup
    console.log('\n3️⃣ Testing CodeSystem search...');
    const codeSystems = await apiCall('GET', '/CodeSystem');
    console.log(`✅ Found ${codeSystems.total} CodeSystems`);
    
    codeSystems.entry.forEach(entry => {
      const cs = entry.resource;
      console.log(`   - ${cs.name}: ${cs.count || 0} concepts (${cs.url})`);
    });

    // 4. Test ConceptMap search
    console.log('\n4️⃣ Testing ConceptMap search...');
    const conceptMaps = await apiCall('GET', '/ConceptMap');
    console.log(`✅ Found ${conceptMaps.total} ConceptMaps`);
    
    conceptMaps.entry.forEach(entry => {
      const cm = entry.resource;
      console.log(`   - ${cm.name}: ${cm.sourceUri} → ${cm.targetUri}`);
    });

    // 5. Create a test patient
    console.log('\n5️⃣ Creating test patient...');
    const patientData = {
      resourceType: 'Patient',
      active: true,
      name: [{
        use: 'official',
        family: 'Sharma',
        given: ['Rajesh', 'Kumar']
      }],
      gender: 'male',
      birthDate: '1980-01-15',
      identifier: [{
        use: 'usual',
        system: 'http://example.org/patient-ids',
        value: 'DEMO-001'
      }]
    };

    try {
      const patient = await apiCall('POST', '/Patient', patientData);
      console.log(`✅ Created patient: ${patient.id}`);

      // 6. Create a problem list entry with dual coding
      console.log('\n6️⃣ Creating problem list entry with dual coding...');
      try {
        // Get a sample NAMASTE code first
        const namasteSearch = await apiCall('GET', '/terminology/$autocomplete?search=fever&systems=namaste&limit=1');
        const namasteMatches = namasteSearch.parameter.filter(p => p.name === 'match');
        
        if (namasteMatches.length > 0) {
          const namasteCode = namasteMatches[0].part.find(p => p.name === 'code')?.valueCoding?.code;
          
          if (namasteCode) {
            const problemListData = {
              patientId: patient.id,
              namasteCode: namasteCode,
              clinicalStatus: 'active',
              verificationStatus: 'confirmed',
              notes: 'Demo problem list entry with dual coding'
            };

            const problemEntry = await apiCall('POST', '/problem-list', problemListData);
            console.log(`✅ Created problem list entry: ${problemEntry.id}`);
            console.log(`   Dual coding: NAMASTE + ${problemEntry.code.coding.length > 1 ? 'ICD-11' : 'single code'}`);
          }
        }
      } catch (error) {
        console.log('⚠️ Problem list creation skipped:', error.response?.data?.issue?.[0]?.details?.text || error.message);
      }

      // 7. Get patient problem list
      console.log('\n7️⃣ Retrieving patient problem list...');
      try {
        const problemList = await apiCall('GET', `/problem-list/${patient.id}`);
        console.log(`✅ Found ${problemList.total} problem list entries`);
        
        if (problemList.entry && problemList.entry.length > 0) {
          const firstCondition = problemList.entry[0].resource;
          console.log(`   Latest: ${firstCondition.code.text} (${firstCondition.code.coding?.length || 0} codes)`);
        }
      } catch (error) {
        console.log('⚠️ Problem list retrieval skipped:', error.response?.data?.issue?.[0]?.details?.text || error.message);
      }

    } catch (error) {
      console.log('⚠️ Patient creation failed:', error.response?.data?.issue?.[0]?.details?.text || error.message);
      console.log('   Continuing with other tests...');
    }

    // 8. Try dual-code lookup
    console.log('\n8️⃣ Testing dual-code lookup...');
    try {
      // Get a sample NAMASTE code first
      const namasteSystem = await apiCall('GET', '/CodeSystem?url=https://ayush.gov.in/fhir/CodeSystem/namaste');
      if (namasteSystem.total > 0 && namasteSystem.entry[0].resource.concept?.length > 0) {
        const sampleCode = namasteSystem.entry[0].resource.concept[0].code;
        console.log(`🔍 Looking up NAMASTE code: ${sampleCode}`);
        
        const dualLookup = await apiCall('GET', `/terminology/$dual-code-lookup?namasteCode=${sampleCode}&includeDetails=true`);
        console.log('✅ Dual-code lookup completed');
        
        const namasteResult = dualLookup.parameter.find(p => p.name === 'namaste');
        if (namasteResult) {
          const code = namasteResult.part.find(p => p.name === 'code')?.valueCoding;
          console.log(`   NAMASTE: ${code?.code} - ${code?.display}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Dual-code lookup test skipped (may need sample data)');
    }

    // 9. Test terminology autocomplete with multiple systems
    console.log('\n9️⃣ Testing multi-system search for "pain"...');
    const multiSearch = await apiCall('GET', '/terminology/$autocomplete?search=pain&systems=namaste,icd11-tm2&limit=3');
    const multiMatches = multiSearch.parameter.filter(p => p.name === 'match');
    
    console.log(`✅ Found ${multiMatches.length} matches across systems`);
    multiMatches.forEach((match, i) => {
      const code = match.part.find(p => p.name === 'code')?.valueCoding;
      const terminology = match.part.find(p => p.name === 'terminology')?.valueString;
      const score = match.part.find(p => p.name === 'score')?.valueDecimal;
      console.log(`   ${i + 1}. [${terminology}] ${code?.code}: ${code?.display} (score: ${score})`);
    });

    // 10. Test FHIR capability statement
    console.log('\n🔟 Testing FHIR capability statement...');
    const capability = await apiCall('GET', '/metadata');
    console.log(`✅ FHIR Version: ${capability.fhirVersion}`);
    console.log(`   Implementation: ${capability.implementation.description}`);
    console.log(`   Resources: ${capability.rest[0].resource.length} types supported`);

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📚 Available endpoints:');
    console.log('   • GET  /fhir/terminology/$autocomplete - Smart search across terminologies');
    console.log('   • POST /fhir/terminology/$translate - Translate between code systems');
    console.log('   • GET  /fhir/terminology/$dual-code-lookup - Look up dual codes');
    console.log('   • POST /fhir/problem-list - Create dual-coded problem list entries');
    console.log('   • GET  /fhir/problem-list/:patientId - Get patient problem list');
    console.log('   • POST /fhir/Bundle - Process transaction bundles with dual coding');
    console.log('   • Standard FHIR R4 endpoints for CodeSystem, ConceptMap, ValueSet, etc.');

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  runDemo();
}

module.exports = { runDemo, apiCall };

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Fetch ICD-11 data from WHO API and update local database
 */
async function fetchICD11Data() {
  try {
    console.log('🔄 Starting ICD-11 API data fetch...');

    // WHO ICD-11 API endpoints
    const icd11ApiUrl = 'https://id.who.int/icd/release/11/2023-01/mms';
    const apiKey = process.env.WHO_API_KEY; // Optional API key for WHO

    const headers = {
      'Accept': 'application/json',
      'API-Version': 'v2',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
    };

    // Get or create ICD-11 CodeSystem
    let icd11CodeSystem = await prisma.codeSystem.findUnique({
      where: { url: 'http://id.who.int/icd/release/11/mms' }
    });

    if (!icd11CodeSystem) {
      icd11CodeSystem = await prisma.codeSystem.create({
        data: {
          url: 'http://id.who.int/icd/release/11/mms',
          name: 'ICD-11',
          title: 'International Classification of Diseases 11th Revision',
          status: 'active',
          description: 'WHO International Classification of Diseases, 11th Revision',
          content: 'complete',
          count: 0
        }
      });
      console.log('✅ Created ICD-11 CodeSystem');
    }

    // Fetch ICD-11 foundation data
    console.log('📡 Fetching ICD-11 foundation data...');
    const foundationResponse = await axios.get(`${icd11ApiUrl}/foundation`, { headers });

    if (foundationResponse.data && foundationResponse.data.child) {
      await processICD11Entities(icd11CodeSystem.id, foundationResponse.data.child, headers);
    }

    // Fetch TM2 specific data
    console.log('📡 Fetching ICD-11 TM2 data...');
    const tm2Response = await axios.get(`${icd11ApiUrl}/foundation?include=TM2`, { headers });

    if (tm2Response.data && tm2Response.data.child) {
      await processICD11Entities(icd11CodeSystem.id, tm2Response.data.child, headers, 'TM2');
    }

    // Update CodeSystem count
    const icd11Count = await prisma.codeSystemConcept.count({
      where: { codeSystemId: icd11CodeSystem.id }
    });

    await prisma.codeSystem.update({
      where: { id: icd11CodeSystem.id },
      data: { count: icd11Count }
    });

    console.log('\n🎉 ICD-11 API data fetch completed!');
    console.log(`📊 ICD-11 CodeSystem: ${icd11Count} concepts`);

  } catch (error) {
    console.error('❌ ICD-11 API fetch failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Recursively process ICD-11 entities
 */
async function processICD11Entities(codeSystemId, entities, headers, category = null) {
  for (const entity of entities) {
    try {
      // Skip if not a valid entity
      if (!entity.code || !entity.title) continue;

      // Check if concept already exists
      const existingConcept = await prisma.codeSystemConcept.findFirst({
        where: {
          code: entity.code,
          codeSystemId: codeSystemId
        }
      });

      if (!existingConcept) {
        // Create ICD-11 concept
        const icd11Concept = await prisma.codeSystemConcept.create({
          data: {
            code: entity.code,
            display: entity.title['@value'] || entity.title,
            definition: entity.definition ? entity.definition['@value'] || entity.definition : null,
            codeSystemId: codeSystemId
          }
        });

        // Add synonyms as designations
        if (entity.synonym && Array.isArray(entity.synonym)) {
          for (const synonym of entity.synonym) {
            if (synonym['@value']) {
              await prisma.codeSystemDesignation.create({
                data: {
                  language: synonym['@language'] || 'en',
                  value: synonym['@value'],
                  use: { system: 'http://terminology.hl7.org/CodeSystem/designation-usage', code: 'synonym' },
                  conceptId: icd11Concept.id
                }
              });
            }
          }
        }

        console.log(`✅ Added ICD-11 concept: ${entity.code} - ${entity.title['@value'] || entity.title}`);
      }

      // Process child entities recursively
      if (entity.child && Array.isArray(entity.child)) {
        await processICD11Entities(codeSystemId, entity.child, headers, category);
      }

    } catch (error) {
      console.log(`❌ Error processing ICD-11 entity ${entity.code}: ${error.message}`);
    }
  }
}

// Run fetch if this script is executed directly
if (require.main === module) {
  fetchICD11Data();
}

module.exports = { fetchICD11Data };

const { PrismaClient } = require('@prisma/client');

async function addSampleTM2Mappings() {
  const prisma = new PrismaClient();

  try {
    console.log('🔗 Adding sample TM2 concept mappings for dual-coding...');
    await prisma.$connect();

    // Get CodeSystems
    const namasteSystem = await prisma.codeSystem.findUnique({
      where: { url: 'https://ayush.gov.in/fhir/CodeSystem/namaste' }
    });

    const tm2System = await prisma.codeSystem.findUnique({
      where: { url: 'http://id.who.int/icd/release/11/mms' }
    });

    const unaniSystem = await prisma.codeSystem.findUnique({
      where: { url: 'https://ayush.gov.in/fhir/CodeSystem/unani' }
    });

    if (!namasteSystem || !tm2System || !unaniSystem) {
      console.log('❌ One or more CodeSystems not found');
      return;
    }

    // Create sample ConceptMap for NAMASTE to TM2 mapping
    const namasteToTM2Map = await prisma.conceptMap.upsert({
      where: { url: 'https://ayush.gov.in/fhir/ConceptMap/namaste-to-icd11-tm2' },
      update: {},
      create: {
        url: 'https://ayush.gov.in/fhir/ConceptMap/namaste-to-icd11-tm2',
        name: 'namaste-to-icd11-tm2',
        title: 'NAMASTE to ICD-11 TM2 Mapping',
        status: 'active',
        description: 'Mapping between NAMASTE and ICD-11 Traditional Medicine terminology',
        sourceUri: namasteSystem.url,
        targetUri: tm2System.url,
        groups: {
          create: [{
            source: namasteSystem.url,
            target: tm2System.url,
            elements: {
              create: [
                // Sample mappings - Vata disorders
                {
                  code: 'SR11',
                  display: 'वातसञ्चयः',
                  targets: {
                    create: [{
                      code: 'TM26.0',
                      display: 'Disorders of vata dosha',
                      equivalence: 'equivalent',
                      comment: 'Vata accumulation maps to vata dosha disorders'
                    }]
                  }
                },
                {
                  code: 'SR12',
                  display: 'वातवृद्धिः',
                  targets: {
                    create: [{
                      code: 'TM26.0',
                      display: 'Disorders of vata dosha',
                      equivalence: 'equivalent',
                      comment: 'Vata increase maps to vata dosha disorders'
                    }]
                  }
                },
                // Sample mappings - Pitta disorders
                {
                  code: 'SR16',
                  display: 'पित्तसञ्चयः',
                  targets: {
                    create: [{
                      code: 'TM27.0',
                      display: 'Disorders of pitta dosha',
                      equivalence: 'equivalent',
                      comment: 'Pitta accumulation maps to pitta dosha disorders'
                    }]
                  }
                }
              ]
            }
          }]
        }
      }
    });

    console.log('✅ Created NAMASTE to TM2 ConceptMap');

    // Create sample ConceptMap for Unani to TM2 mapping
    const unaniToTM2Map = await prisma.conceptMap.upsert({
      where: { url: 'https://ayush.gov.in/fhir/ConceptMap/unani-to-icd11-tm2' },
      update: {},
      create: {
        url: 'https://ayush.gov.in/fhir/ConceptMap/unani-to-icd11-tm2',
        name: 'unani-to-icd11-tm2',
        title: 'Unani to ICD-11 TM2 Mapping',
        status: 'active',
        description: 'Mapping between Unani and ICD-11 Traditional Medicine terminology',
        sourceUri: unaniSystem.url,
        targetUri: tm2System.url,
        groups: {
          create: [{
            source: unaniSystem.url,
            target: tm2System.url,
            elements: {
              create: [
                // Sample mappings - Unani to TM2
                {
                  code: 'A-2',
                  display: 'شقيقہ',
                  targets: {
                    create: [{
                      code: 'SK01',
                      display: 'Migraine disorder',
                      equivalence: 'equivalent',
                      comment: 'Shaqeeqa (migraine) maps to migraine disorder'
                    }]
                  }
                }
              ]
            }
          }]
        }
      }
    });

    console.log('✅ Created Unani to TM2 ConceptMap');

    // Add some sample conditions using TM2 codes
    console.log('🏥 Adding sample patient conditions with TM2 codes...');

    // Get a sample patient or create one
    let samplePatient = await prisma.patient.findFirst();
    if (!samplePatient) {
      samplePatient = await prisma.patient.create({
        data: {
          gender: 'female',
          birthDate: new Date('1990-01-01'),
          names: {
            create: [{
              family: 'Sharma',
              given: ['Priya']
            }]
          },
          identifiers: {
            create: [{
              system: 'https://ayush.gov.in/patient',
              value: 'PAT001'
            }]
          }
        }
      });
      console.log('✅ Created sample patient');
    }

    // Add sample conditions using TM2 codes
    const sampleConditions = [
      {
        code: {
          system: tm2System.url,
          code: 'SK01',
          display: 'Migraine disorder'
        },
        clinicalStatus: { code: 'active' },
        verificationStatus: { code: 'confirmed' },
        category: [{ code: 'encounter-diagnosis' }],
        recordedDate: new Date()
      },
      {
        code: {
          system: tm2System.url,
          code: 'SL40',
          display: 'Bronchial asthma disorder'
        },
        clinicalStatus: { code: 'active' },
        verificationStatus: { code: 'confirmed' },
        category: [{ code: 'encounter-diagnosis' }],
        recordedDate: new Date()
      },
      {
        code: {
          system: namasteSystem.url,
          code: 'SR11',
          display: 'वातसञ्चयः'
        },
        clinicalStatus: { code: 'active' },
        verificationStatus: { code: 'confirmed' },
        category: [{ code: 'encounter-diagnosis' }],
        recordedDate: new Date()
      }
    ];

    for (const conditionData of sampleConditions) {
      await prisma.condition.create({
        data: {
          ...conditionData,
          subjectId: samplePatient.id
        }
      });
    }

    console.log('✅ Added sample conditions with TM2 codes');

    // Count total mappings and conditions
    const totalMaps = await prisma.conceptMap.count();
    const totalConditions = await prisma.condition.count();

    console.log(`\n📊 Summary:`);
    console.log(`  - Concept Maps: ${totalMaps}`);
    console.log(`  - Patient Conditions: ${totalConditions}`);
    console.log(`  - TM2 Concepts: 646`);
    console.log(`  - NAMASTE Concepts: 3490`);
    console.log(`  - Unani Concepts: 338`);

    console.log('\n🎉 Sample TM2 mappings and data added successfully!');

  } catch (error) {
    console.error('❌ Failed to add sample mappings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if this script is executed directly
if (require.main === module) {
  addSampleTM2Mappings();
}

module.exports = { addSampleTM2Mappings };

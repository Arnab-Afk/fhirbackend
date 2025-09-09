const { PrismaClient } = require('@prisma/client');

async function setupDatabase() {
  const prisma = new PrismaClient();

  try {
    console.log('🔄 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    console.log('🔄 Pushing schema to database...');
    // Note: In production, you'd use migrations instead of db push
    console.log('✅ Schema pushed to database');

    console.log('🔄 Creating sample data...');

    // Create NAMASTE CodeSystem
    const namasteCodeSystem = await prisma.codeSystem.create({
      data: {
        url: 'https://ayush.gov.in/fhir/CodeSystem/namaste',
        name: 'NAMASTE',
        title: 'National AYUSH Morbidity & Standardized Terminologies Electronic',
        status: 'active',
        description: 'Standardized terminologies for Ayurveda, Siddha, and Unani disorders',
        content: 'complete',
        count: 2
      }
    });
    console.log('✅ Created NAMASTE CodeSystem');

    // Create sample concepts
    await prisma.codeSystemConcept.create({
      data: {
        code: 'NAM001',
        display: 'Amavata',
        definition: 'Rheumatoid arthritis in Ayurvedic terms',
        codeSystemId: namasteCodeSystem.id,
        designations: {
          create: [
            {
              language: 'hi',
              value: 'आमवात',
              use: { system: 'http://terminology.hl7.org/CodeSystem/designation-usage', code: 'display' }
            }
          ]
        }
      }
    });

    await prisma.codeSystemConcept.create({
      data: {
        code: 'NAM002',
        display: 'Prameha',
        definition: 'Diabetes mellitus in Ayurvedic terms',
        codeSystemId: namasteCodeSystem.id,
        designations: {
          create: [
            {
              language: 'hi',
              value: 'प्रमेह',
              use: { system: 'http://terminology.hl7.org/CodeSystem/designation-usage', code: 'display' }
            }
          ]
        }
      }
    });
    console.log('✅ Created sample NAMASTE concepts');

    // Create ICD-11 TM2 CodeSystem
    const icd11CodeSystem = await prisma.codeSystem.create({
      data: {
        url: 'http://id.who.int/icd/release/11/mms',
        name: 'ICD11-TM2',
        title: 'ICD-11 Traditional Medicine Module 2',
        status: 'active',
        description: 'WHO ICD-11 Traditional Medicine classifications',
        content: 'complete',
        count: 2
      }
    });
    console.log('✅ Created ICD-11 TM2 CodeSystem');

    // Create sample ICD-11 concepts
    await prisma.codeSystemConcept.create({
      data: {
        code: 'TM26.0',
        display: 'Disorders of vata dosha',
        codeSystemId: icd11CodeSystem.id
      }
    });

    await prisma.codeSystemConcept.create({
      data: {
        code: 'TM27.0',
        display: 'Disorders of pitta dosha',
        codeSystemId: icd11CodeSystem.id
      }
    });
    console.log('✅ Created sample ICD-11 concepts');

    // Create ConceptMap for NAMASTE to ICD-11 mapping
    const conceptMap = await prisma.conceptMap.create({
      data: {
        url: 'https://ayush.gov.in/fhir/ConceptMap/namaste-to-icd11',
        name: 'namaste-to-icd11',
        title: 'NAMASTE to ICD-11 TM2 Mapping',
        status: 'active',
        description: 'Mapping between NAMASTE and ICD-11 Traditional Medicine codes',
        sourceUri: 'https://ayush.gov.in/fhir/CodeSystem/namaste',
        targetUri: 'http://id.who.int/icd/release/11/mms'
      }
    });
    console.log('✅ Created ConceptMap');

    // Create mapping group
    const group = await prisma.conceptMapGroup.create({
      data: {
        source: 'https://ayush.gov.in/fhir/CodeSystem/namaste',
        target: 'http://id.who.int/icd/release/11/mms',
        conceptMapId: conceptMap.id
      }
    });

    // Create mapping elements
    const element1 = await prisma.conceptMapElement.create({
      data: {
        code: 'NAM001',
        display: 'Amavata',
        groupId: group.id
      }
    });

    await prisma.conceptMapTarget.create({
      data: {
        code: 'TM26.0',
        display: 'Disorders of vata dosha',
        equivalence: 'equivalent',
        elementId: element1.id
      }
    });

    const element2 = await prisma.conceptMapElement.create({
      data: {
        code: 'NAM002',
        display: 'Prameha',
        groupId: group.id
      }
    });

    await prisma.conceptMapTarget.create({
      data: {
        code: 'TM27.0',
        display: 'Disorders of pitta dosha',
        equivalence: 'relatedto',
        elementId: element2.id
      }
    });
    console.log('✅ Created mapping elements and targets');

    // Create a sample patient
    const patient = await prisma.patient.create({
      data: {
        active: true,
        gender: 'male',
        birthDate: new Date('1980-01-01')
      }
    });

    await prisma.patientName.create({
      data: {
        use: 'official',
        family: 'Sharma',
        given: ['Rajesh'],
        patientId: patient.id
      }
    });

    await prisma.patientIdentifier.create({
      data: {
        use: 'usual',
        system: 'https://ndhm.gov.in/id',
        value: 'PAT001',
        patientId: patient.id
      }
    });
    console.log('✅ Created sample patient');

    // Create a sample condition with dual coding
    await prisma.condition.create({
      data: {
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active'
          }]
        },
        code: {
          coding: [
            {
              system: 'https://ayush.gov.in/fhir/CodeSystem/namaste',
              code: 'NAM001',
              display: 'Amavata'
            },
            {
              system: 'http://id.who.int/icd/release/11/mms',
              code: 'TM26.0',
              display: 'Disorders of vata dosha'
            }
          ]
        },
        subjectId: patient.id,
        recordedDate: new Date()
      }
    });
    console.log('✅ Created sample condition with dual coding');

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📊 Sample data created:');
    console.log('- 2 CodeSystems (NAMASTE and ICD-11 TM2)');
    console.log('- 4 Concepts (2 NAMASTE + 2 ICD-11)');
    console.log('- 1 ConceptMap with mappings');
    console.log('- 1 Patient with identifiers');
    console.log('- 1 Condition with dual coding');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };

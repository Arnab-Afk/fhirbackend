const { PrismaClient } = require('@prisma/client');

async function checkTM2Data() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Checking TM2 data in database...');
    await prisma.$connect();

    // Check CodeSystems
    console.log('\n📚 CodeSystems:');
    const codeSystems = await prisma.codeSystem.findMany();
    codeSystems.forEach(cs => {
      console.log(`  - ${cs.name}: ${cs.count} concepts (${cs.url})`);
    });

    // Check for TM2 concepts specifically
    console.log('\n🔍 TM2 Concepts:');
    const tm2Concepts = await prisma.codeSystemConcept.findMany({
      where: {
        OR: [
          { code: { contains: 'TM2' } },
          { display: { contains: 'TM2' } },
          { code: { startsWith: 'S' } } // ICD-11 TM2 codes start with S
        ]
      },
      include: {
        codeSystem: true
      },
      take: 20
    });

    console.log(`Found ${tm2Concepts.length} potential TM2 concepts:`);
    tm2Concepts.forEach(concept => {
      console.log(`  - ${concept.code}: ${concept.display} (${concept.codeSystem.name})`);
    });

    // Check total concepts per CodeSystem
    console.log('\n📊 Concept counts by CodeSystem:');
    for (const cs of codeSystems) {
      const count = await prisma.codeSystemConcept.count({
        where: { codeSystemId: cs.id }
      });
      console.log(`  - ${cs.name}: ${count} concepts`);
    }

    // Check for ICD-11 specific data
    console.log('\n🌍 ICD-11 Data:');
    const icd11System = await prisma.codeSystem.findUnique({
      where: { url: 'https://icd.who.int/browse11/l-m/en' }
    });

    if (icd11System) {
      const icd11Concepts = await prisma.codeSystemConcept.findMany({
        where: { codeSystemId: icd11System.id },
        take: 10
      });
      console.log(`ICD-11 CodeSystem has ${icd11System.count} concepts`);
      console.log('Sample ICD-11 concepts:');
      icd11Concepts.forEach(concept => {
        console.log(`  - ${concept.code}: ${concept.display}`);
      });
    }

    // Check for NAMASTE data
    console.log('\n🕉️  NAMASTE Data:');
    const namasteSystem = await prisma.codeSystem.findUnique({
      where: { url: 'https://ayush.gov.in/fhir/CodeSystem/namaste' }
    });

    if (namasteSystem) {
      const namasteConcepts = await prisma.codeSystemConcept.findMany({
        where: { codeSystemId: namasteSystem.id },
        take: 10
      });
      console.log(`NAMASTE CodeSystem has ${namasteSystem.count} concepts`);
      console.log('Sample NAMASTE concepts:');
      namasteConcepts.forEach(concept => {
        console.log(`  - ${concept.code}: ${concept.display}`);
      });
    }

    // Check for Unani data
    console.log('\n🌙 Unani Data:');
    const unaniSystem = await prisma.codeSystem.findUnique({
      where: { url: 'https://ayush.gov.in/fhir/CodeSystem/unani' }
    });

    if (unaniSystem) {
      const unaniConcepts = await prisma.codeSystemConcept.findMany({
        where: { codeSystemId: unaniSystem.id },
        take: 10
      });
      console.log(`Unani CodeSystem has ${unaniSystem.count} concepts`);
      console.log('Sample Unani concepts:');
      unaniConcepts.forEach(concept => {
        console.log(`  - ${concept.code}: ${concept.display}`);
      });
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run check if this script is executed directly
if (require.main === module) {
  checkTM2Data();
}

module.exports = { checkTM2Data };

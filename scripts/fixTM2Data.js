const { PrismaClient } = require('@prisma/client');

async function fixTM2Data() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Fixing TM2 data in database...');
    await prisma.$connect();

    // Get the ICD11-TM2 CodeSystem
    const tm2CodeSystem = await prisma.codeSystem.findUnique({
      where: { url: 'http://id.who.int/icd/release/11/mms' }
    });

    if (!tm2CodeSystem) {
      console.log('❌ ICD11-TM2 CodeSystem not found');
      return;
    }

    console.log(`📚 Found ICD11-TM2 CodeSystem: ${tm2CodeSystem.name} (${tm2CodeSystem.count} concepts)`);

    // Get current TM2 concepts
    const currentTM2Concepts = await prisma.codeSystemConcept.findMany({
      where: { codeSystemId: tm2CodeSystem.id }
    });

    console.log('Current TM2 concepts:');
    currentTM2Concepts.forEach(concept => {
      console.log(`  - ${concept.code}: ${concept.display}`);
    });

    // Get the ICD-11 CodeSystem that has the TM2 data
    const icd11CodeSystem = await prisma.codeSystem.findUnique({
      where: { url: 'https://icd.who.int/browse11/l-m/en' }
    });

    if (!icd11CodeSystem) {
      console.log('❌ ICD-11 CodeSystem not found');
      return;
    }

    // Get all concepts from ICD-11 that should be TM2
    const icd11Concepts = await prisma.codeSystemConcept.findMany({
      where: {
        codeSystemId: icd11CodeSystem.id,
        OR: [
          { code: { startsWith: 'S' } }, // TM2 codes start with S
          { display: { contains: '(TM2)' } }
        ]
      }
    });

    console.log(`\n📊 Found ${icd11Concepts.length} TM2 concepts in ICD-11 CodeSystem`);

    // Move concepts from ICD-11 to ICD11-TM2
    let movedCount = 0;
    for (const concept of icd11Concepts) {
      // Check if concept already exists in TM2
      const existingTM2Concept = await prisma.codeSystemConcept.findFirst({
        where: {
          code: concept.code,
          codeSystemId: tm2CodeSystem.id
        }
      });

      if (!existingTM2Concept) {
        // Move concept to TM2 CodeSystem
        await prisma.codeSystemConcept.update({
          where: { id: concept.id },
          data: { codeSystemId: tm2CodeSystem.id }
        });
        movedCount++;
      }
    }

    console.log(`✅ Moved ${movedCount} concepts to ICD11-TM2 CodeSystem`);

    // Update counts
    const newTM2Count = await prisma.codeSystemConcept.count({
      where: { codeSystemId: tm2CodeSystem.id }
    });

    const newICD11Count = await prisma.codeSystemConcept.count({
      where: { codeSystemId: icd11CodeSystem.id }
    });

    await prisma.codeSystem.update({
      where: { id: tm2CodeSystem.id },
      data: { count: newTM2Count }
    });

    await prisma.codeSystem.update({
      where: { id: icd11CodeSystem.id },
      data: { count: newICD11Count }
    });

    console.log(`\n📊 Updated counts:`);
    console.log(`  - ICD11-TM2: ${newTM2Count} concepts`);
    console.log(`  - ICD-11: ${newICD11Count} concepts`);

    // Show sample of TM2 concepts
    const sampleTM2Concepts = await prisma.codeSystemConcept.findMany({
      where: { codeSystemId: tm2CodeSystem.id },
      take: 10
    });

    console.log('\n🩺 Sample TM2 concepts:');
    sampleTM2Concepts.forEach(concept => {
      console.log(`  - ${concept.code}: ${concept.display}`);
    });

    console.log('\n🎉 TM2 data fix completed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run fix if this script is executed directly
if (require.main === module) {
  fixTM2Data();
}

module.exports = { fixTM2Data };

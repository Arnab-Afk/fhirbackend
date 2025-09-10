const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('🔍 Checking database contents...\n');

    // Check CodeSystems
    const codeSystems = await prisma.codeSystem.findMany({
      select: {
        name: true,
        url: true,
        count: true,
        _count: {
          select: {
            concepts: true
          }
        }
      }
    });

    console.log('📚 Code Systems:');
    codeSystems.forEach(cs => {
      console.log(`  - ${cs.name}: ${cs._count.concepts} concepts (${cs.url})`);
    });

    // Check ConceptMaps
    const conceptMaps = await prisma.conceptMap.findMany({
      select: {
        name: true,
        url: true,
        sourceUri: true,
        targetUri: true
      }
    });

    console.log('\n🔗 Concept Maps:');
    if (conceptMaps.length === 0) {
      console.log('  No ConceptMaps found');
    } else {
      conceptMaps.forEach(cm => {
        console.log(`  - ${cm.name}: ${cm.sourceUri} -> ${cm.targetUri}`);
      });
    }

    // Check sample concepts
    if (codeSystems.length > 0) {
      console.log('\n📋 Sample Concepts:');
      for (const codeSystem of codeSystems.slice(0, 2)) {
        const concepts = await prisma.codeSystemConcept.findMany({
          where: { codeSystemId: { in: [codeSystem.url] } },
          take: 3,
          select: {
            code: true,
            display: true,
            codeSystem: {
              select: { name: true }
            }
          }
        });

        console.log(`  ${codeSystem.name}:`);
        concepts.forEach(concept => {
          console.log(`    - ${concept.code}: ${concept.display}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();

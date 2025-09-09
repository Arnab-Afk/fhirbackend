const { PrismaClient } = require('@prisma/client');

async function checkTM2Concepts() {
  const prisma = new PrismaClient();

  try {
    const concepts = await prisma.codeSystemConcept.findMany({
      where: { codeSystemId: 'cmfcyyugq0007srbpohh1o7s9' },
      select: {
        code: true,
        display: true
      },
      take: 10
    });

    console.log('TM2 Concepts:');
    concepts.forEach(c => {
      console.log(`Code: ${c.code}, Display: ${c.display}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTM2Concepts();

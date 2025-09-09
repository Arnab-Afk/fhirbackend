const { PrismaClient } = require('@prisma/client');

async function checkCodeSystems() {
  const prisma = new PrismaClient();

  try {
    const codeSystems = await prisma.codeSystem.findMany({
      select: {
        id: true,
        name: true,
        url: true
      }
    });

    console.log('Available CodeSystems:');
    codeSystems.forEach(cs => {
      console.log(`ID: ${cs.id}, Name: ${cs.name}, URL: ${cs.url}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCodeSystems();

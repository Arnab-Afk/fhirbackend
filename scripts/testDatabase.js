const { PrismaClient } = require('@prisma/client');

async function testServer() {
  const prisma = new PrismaClient();

  try {
    console.log('🧪 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Test basic queries
    console.log('🧪 Testing CodeSystem queries...');
    const codeSystems = await prisma.codeSystem.findMany({ take: 5 });
    console.log(`✅ Found ${codeSystems.length} CodeSystems`);

    console.log('🧪 Testing ConceptMap queries...');
    const conceptMaps = await prisma.conceptMap.findMany({ take: 5 });
    console.log(`✅ Found ${conceptMaps.length} ConceptMaps`);

    console.log('🧪 Testing Patient queries...');
    const patients = await prisma.patient.findMany({ take: 5 });
    console.log(`✅ Found ${patients.length} Patients`);

    console.log('🧪 Testing Condition queries...');
    const conditions = await prisma.condition.findMany({ take: 5 });
    console.log(`✅ Found ${conditions.length} Conditions`);

    console.log('\n🎉 All database tests passed!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Test health endpoint: curl http://localhost:3000/health');
    console.log('3. Test FHIR metadata: curl http://localhost:3000/fhir/metadata');
    console.log('4. Test CodeSystem search: curl "http://localhost:3000/fhir/CodeSystem"');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testServer();
}

module.exports = { testServer };

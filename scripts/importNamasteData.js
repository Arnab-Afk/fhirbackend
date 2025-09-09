const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function importNamasteData() {
  try {
    console.log('🔄 Starting NAMASTE data import...');

    // Read the CSV file
    const csvPath = path.join(__dirname, '..', 'namaste_csv.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');

    // Parse CSV data
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

    console.log(`📊 Found ${lines.length - 1} data rows in CSV`);

    // Get or create NAMASTE CodeSystem
    let namasteCodeSystem = await prisma.codeSystem.findUnique({
      where: { url: 'https://ayush.gov.in/fhir/CodeSystem/namaste' }
    });

    if (!namasteCodeSystem) {
      namasteCodeSystem = await prisma.codeSystem.create({
        data: {
          url: 'https://ayush.gov.in/fhir/CodeSystem/namaste',
          name: 'NAMASTE',
          title: 'National AYUSH Morbidity & Standardized Terminologies Electronic',
          status: 'active',
          description: 'Standardized terminologies for Ayurveda, Siddha, and Unani disorders',
          content: 'complete',
          count: 0
        }
      });
      console.log('✅ Created NAMASTE CodeSystem');
    }

    // Get or create Unani CodeSystem
    let unaniCodeSystem = await prisma.codeSystem.findUnique({
      where: { url: 'https://ayush.gov.in/fhir/CodeSystem/unani' }
    });

    if (!unaniCodeSystem) {
      unaniCodeSystem = await prisma.codeSystem.create({
        data: {
          url: 'https://ayush.gov.in/fhir/CodeSystem/unani',
          name: 'UNANI',
          title: 'Unani Medicine Terminology',
          status: 'active',
          description: 'Standardized terminologies for Unani medicine',
          content: 'complete',
          count: 0
        }
      });
      console.log('✅ Created Unani CodeSystem');
    }

    let importedCount = 0;
    let skippedCount = 0;

    // Process each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted fields)
      const values = parseCSVLine(line);

      if (values.length < 12) {
        console.log(`⚠️  Skipping line ${i + 1}: insufficient data`);
        skippedCount++;
        continue;
      }

      const [
        srNo,
        namcId,
        namcCode,
        namcTermDevanagari,
        system,
        namcTerm2,
        tamilTerm,
        numcId,
        numcCode,
        arabicTerm,
        numcTerm,
        definition
      ] = values;

      try {
        // Create NAMASTE concept if NAMC_CODE exists
        if (namcCode && namcCode.trim()) {
          const existingNamasteConcept = await prisma.codeSystemConcept.findFirst({
            where: {
              code: namcCode.trim(),
              codeSystemId: namasteCodeSystem.id
            }
          });

          if (!existingNamasteConcept) {
            const namasteConcept = await prisma.codeSystemConcept.create({
              data: {
                code: namcCode.trim(),
                display: namcTermDevanagari || namcTerm2 || namcCode,
                definition: definition || null,
                codeSystemId: namasteCodeSystem.id
              }
            });

            // Add designations for different languages
            if (namcTermDevanagari && namcTermDevanagari !== namcCode) {
              await prisma.codeSystemDesignation.create({
                data: {
                  language: 'sa',
                  value: namcTermDevanagari,
                  use: { system: 'http://terminology.hl7.org/CodeSystem/designation-usage', code: 'display' },
                  conceptId: namasteConcept.id
                }
              });
            }

            if (tamilTerm && tamilTerm.trim()) {
              await prisma.codeSystemDesignation.create({
                data: {
                  language: 'ta',
                  value: tamilTerm.trim(),
                  use: { system: 'http://terminology.hl7.org/CodeSystem/designation-usage', code: 'display' },
                  conceptId: namasteConcept.id
                }
              });
            }

            importedCount++;
          }
        }

        // Create Unani concept if NUMC_CODE exists
        if (numcCode && numcCode.trim()) {
          const existingUnaniConcept = await prisma.codeSystemConcept.findFirst({
            where: {
              code: numcCode.trim(),
              codeSystemId: unaniCodeSystem.id
            }
          });

          if (!existingUnaniConcept) {
            const unaniConcept = await prisma.codeSystemConcept.create({
              data: {
                code: numcCode.trim(),
                display: arabicTerm || numcTerm || numcCode,
                definition: definition || null,
                codeSystemId: unaniCodeSystem.id
              }
            });

            // Add Arabic designation
            if (arabicTerm && arabicTerm.trim()) {
              await prisma.codeSystemDesignation.create({
                data: {
                  language: 'ar',
                  value: arabicTerm.trim(),
                  use: { system: 'http://terminology.hl7.org/CodeSystem/designation-usage', code: 'display' },
                  conceptId: unaniConcept.id
                }
              });
            }

            importedCount++;
          }
        }

        // Log progress every 50 records
        if ((importedCount + skippedCount) % 50 === 0) {
          console.log(`📊 Processed ${importedCount + skippedCount} records...`);
        }

      } catch (error) {
        console.log(`❌ Error processing line ${i + 1}: ${error.message}`);
        skippedCount++;
      }
    }

    // Update CodeSystem counts
    const namasteCount = await prisma.codeSystemConcept.count({
      where: { codeSystemId: namasteCodeSystem.id }
    });

    const unaniCount = await prisma.codeSystemConcept.count({
      where: { codeSystemId: unaniCodeSystem.id }
    });

    await prisma.codeSystem.update({
      where: { id: namasteCodeSystem.id },
      data: { count: namasteCount }
    });

    await prisma.codeSystem.update({
      where: { id: unaniCodeSystem.id },
      data: { count: unaniCount }
    });

    console.log('\n🎉 NAMASTE data import completed!');
    console.log(`✅ Imported: ${importedCount} concepts`);
    console.log(`⚠️  Skipped: ${skippedCount} records`);
    console.log(`📊 NAMASTE CodeSystem: ${namasteCount} concepts`);
    console.log(`📊 Unani CodeSystem: ${unaniCount} concepts`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to parse CSV line with quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  result.push(current.trim().replace(/^"|"$/g, ''));

  return result;
}

// Run import if this script is executed directly
if (require.main === module) {
  importNamasteData();
}

module.exports = { importNamasteData };

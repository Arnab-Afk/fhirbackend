const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function importICD11Data() {
  try {
    console.log('🔄 Starting ICD-11 data import...');

    // Read the CSV file
    const csvPath = path.join(__dirname, '..', 'final_icd_11.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');

    // Parse CSV data
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

    console.log(`📊 Found ${lines.length - 1} data rows in ICD-11 CSV`);

    // Get or create ICD-11 CodeSystem
    let icd11CodeSystem = await prisma.codeSystem.findUnique({
      where: { url: 'https://icd.who.int/browse11/l-m/en' }
    });

    if (!icd11CodeSystem) {
      icd11CodeSystem = await prisma.codeSystem.create({
        data: {
          url: 'https://icd.who.int/browse11/l-m/en',
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

    let importedCount = 0;
    let skippedCount = 0;

    // Process each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted fields)
      const values = parseCSVLine(line);

      if (values.length < 5) {
        console.log(`⚠️  Skipping line ${i + 1}: insufficient data`);
        skippedCount++;
        continue;
      }

      const [code, diseaseName, symptoms, searchQuality, coreTerms] = values;

      try {
        // Skip entries that are just categories or modules
        if (code.startsWith(',') || code.includes('Module II') ||
            diseaseName.includes('Skipped') || diseaseName.includes('Not a specific disease')) {
          skippedCount++;
          continue;
        }

        // Clean the code and disease name
        const cleanCode = code.trim();
        const cleanDiseaseName = diseaseName.replace(/^"|"$/g, '').trim();

        if (!cleanCode || !cleanDiseaseName) {
          skippedCount++;
          continue;
        }

        // Check if concept already exists
        const existingConcept = await prisma.codeSystemConcept.findFirst({
          where: {
            code: cleanCode,
            codeSystemId: icd11CodeSystem.id
          }
        });

        if (!existingConcept) {
          // Create ICD-11 concept
          const icd11Concept = await prisma.codeSystemConcept.create({
            data: {
              code: cleanCode,
              display: cleanDiseaseName,
              definition: symptoms && symptoms !== 'Skipped' ? symptoms.replace(/^"|"$/g, '').trim() : null,
              codeSystemId: icd11CodeSystem.id
            }
          });

          // Add core terms as designations if available
          if (coreTerms && coreTerms.trim() && coreTerms !== 'Skipped') {
            const terms = coreTerms.replace(/^"|"$/g, '').split(',').map(term => term.trim()).filter(term => term);
            for (const term of terms) {
              if (term) {
                await prisma.codeSystemDesignation.create({
                  data: {
                    language: 'en',
                    value: term,
                    use: { system: 'http://terminology.hl7.org/CodeSystem/designation-usage', code: 'synonym' },
                    conceptId: icd11Concept.id
                  }
                });
              }
            }
          }

          importedCount++;
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

    // Update CodeSystem count
    const icd11Count = await prisma.codeSystemConcept.count({
      where: { codeSystemId: icd11CodeSystem.id }
    });

    await prisma.codeSystem.update({
      where: { id: icd11CodeSystem.id },
      data: { count: icd11Count }
    });

    console.log('\n🎉 ICD-11 data import completed!');
    console.log(`✅ Imported: ${importedCount} concepts`);
    console.log(`⚠️  Skipped: ${skippedCount} records`);
    console.log(`📊 ICD-11 CodeSystem: ${icd11Count} concepts`);

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
  importICD11Data();
}

module.exports = { importICD11Data };

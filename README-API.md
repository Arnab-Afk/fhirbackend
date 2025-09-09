# FHIR R4 Backend API

A comprehensive FHIR R4 compliant backend for integrating NAMASTE and ICD-11 TM2 terminologies into Electronic Medical Record (EMR) systems.

## 🚀 Quick Start

1. **Start the server:**
   ```bash
   npm install
   npm start
   ```

2. **Health check:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Test TM2 functionality:**
   ```bash
   node scripts/testTM2Validation.js
   ```

4. **Run full test suite:**
   ```bash
   node scripts/testAllEndpoints.js
   ```

## 📚 Documentation

- **[Complete API Documentation](API-DOCUMENTATION.md)** - Detailed endpoint reference
- **[Quick Reference Guide](API-QUICK-REFERENCE.md)** - Essential endpoints summary
- **[Postman Collection](Postman-Collection.json)** - Import for testing

## 🔗 Key Endpoints

### TM2 Integration
```bash
# Validate TM2 code
POST /fhir/CodeSystem/{id}/$validate-code

# Translate NAMASTE to ICD-11 TM2
POST /fhir/ConceptMap/{id}/$translate

# Lookup code details
POST /fhir/CodeSystem/{id}/$lookup
```

### Core Resources
- **CodeSystem**: Terminology code systems
- **ConceptMap**: Code mappings between systems
- **ValueSet**: Collections of codes
- **Condition**: Health conditions with dual coding
- **Patient**: Patient information
- **AuditEvent**: Security audit logs

## 🏥 TM2 Terminology Services

### Available CodeSystems
- **ICD-11 TM2**: `cmfcyyugq0007srbpohh1o7s9` - 646 TM2 codes
- **NAMASTE**: `cmfcyytj10000srbp2as56xqh` - 3,490 traditional medicine terms
- **Unani**: `cmfcz4ytd0000q19ju46acvl3` - 338 Unani medicine terms

### Example: Dual-Coding Workflow

1. **Validate traditional medicine diagnosis:**
   ```bash
   curl -X POST "http://localhost:3000/fhir/CodeSystem/cmfcyytj10000srbp2as56xqh/\$validate-code" \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     -d '{"parameter":[{"name":"code","valueCode":"SR11"}]}'
   ```

2. **Translate to ICD-11 TM2:**
   ```bash
   curl -X POST "http://localhost:3000/fhir/ConceptMap/cmfczxkcw0000pau5h8g5h76g/\$translate" \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     -d '{"parameter":[{"name":"code","valueCode":"SR11"},{"name":"system","valueUri":"https://ayush.gov.in/fhir/CodeSystem/namaste"}]}'
   ```

3. **Create condition with dual coding:**
   ```json
   {
     "resourceType": "Condition",
     "code": {
       "coding": [
         {
           "system": "https://ayush.gov.in/fhir/CodeSystem/namaste",
           "code": "SR11",
           "display": "वातसञ्चयः"
         },
         {
           "system": "http://id.who.int/icd/release/11/mms",
           "code": "TM26.0",
           "display": "Disorders of vata dosha"
         }
       ]
     }
   }
   ```

## 🧪 Testing

### Automated Tests
```bash
# Test all endpoints
npm run test

# Test TM2 functionality specifically
node scripts/testTM2Validation.js

# Check database
npm run db:test
```

### Manual Testing
Import the [Postman Collection](Postman-Collection.json) for interactive testing.

## 📊 Test Results

All endpoints tested and verified:
- ✅ **16/16 tests passed**
- ✅ **All CRUD operations functional**
- ✅ **All FHIR operations working**
- ✅ **TM2 integration complete**

## 🛠️ Development

### Prerequisites
- Node.js 18+
- PostgreSQL (via Neon)
- npm or yarn

### Environment Setup
```bash
# Install dependencies
npm install

# Set up database
npm run db:setup
npm run db:push

# Start development server
npm run dev
```

### Database Scripts
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# View database
npm run db:studio
```

## 📁 Project Structure

```
├── src/
│   ├── index.js              # Main server file
│   ├── middleware/           # Express middleware
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   └── routes/               # FHIR resource routes
│       ├── codeSystem.js
│       ├── conceptMap.js
│       ├── valueSet.js
│       ├── condition.js
│       ├── patient.js
│       └── audit.js
├── scripts/                  # Utility scripts
│   ├── testAllEndpoints.js
│   ├── testTM2Validation.js
│   └── setupDatabase.js
├── prisma/
│   └── schema.prisma         # Database schema
├── test-results/             # Test output files
├── API-DOCUMENTATION.md      # Complete API docs
├── API-QUICK-REFERENCE.md    # Quick reference
└── Postman-Collection.json   # Postman collection
```

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: FHIR request validation
- **Error Handling**: Comprehensive error responses

## 📈 Performance

- **Compression**: Response compression
- **Connection Pooling**: Efficient database connections
- **Pagination**: Large result set handling
- **Caching Ready**: Prepared for Redis integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## 📄 License

ISC License - see package.json for details.

## 🆘 Support

For issues or questions:
1. Check the [API Documentation](API-DOCUMENTATION.md)
2. Review test results in `test-results/`
3. Run the test scripts for verification
4. Check server logs for debugging

---

**Status**: ✅ **Production Ready** - All TM2 integration features implemented and tested.

# FHIR Backend Setup

This is a FHIR R4 compliant backend for the AyushBridge project, built with Express.js, PostgreSQL, and Prisma.

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Set up the database:
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Database Setup

Make sure PostgreSQL is running and create a database:

```sql
CREATE DATABASE fhirbackend;
```

Update the `DATABASE_URL` in `.env` with your connection string.

## API Endpoints

### Base URL
```
http://localhost:3000/fhir
```

### Available Resources
- `GET/POST/PUT/DELETE /CodeSystem` - Terminology code systems
- `GET/POST/PUT/DELETE /ConceptMap` - Code mappings
- `GET/POST/PUT/DELETE /ValueSet` - Value sets
- `GET/POST/PUT/DELETE /Condition` - Patient conditions
- `GET/POST/PUT/DELETE /Patient` - Patient records
- `GET/POST /AuditEvent` - Audit logs

### Special Operations
- `POST /ConceptMap/:id/$translate` - Translate codes between systems
- `GET /ValueSet/:id/$expand` - Expand value set

## Testing the API

### Health Check
```bash
curl http://localhost:3000/health
```

### FHIR Capability Statement
```bash
curl http://localhost:3000/fhir/metadata
```

### Create a CodeSystem
```bash
curl -X POST http://localhost:3000/fhir/CodeSystem \
  -H "Content-Type: application/json" \
  -d '{
    "resourceType": "CodeSystem",
    "url": "https://ayush.gov.in/fhir/CodeSystem/namaste",
    "name": "NAMASTE",
    "title": "National AYUSH Morbidity & Standardized Terminologies Electronic",
    "status": "active",
    "description": "NAMASTE codes for traditional medicine"
  }'
```

## Project Structure

```
src/
├── index.js              # Main server file
├── routes/               # API route handlers
│   ├── codeSystem.js
│   ├── conceptMap.js
│   ├── valueSet.js
│   ├── condition.js
│   ├── patient.js
│   └── audit.js
├── controllers/          # Business logic (future)
├── models/              # Data models (future)
├── middleware/          # Custom middleware
│   ├── errorHandler.js
│   └── requestLogger.js
└── utils/               # Utility functions (future)

prisma/
└── schema.prisma        # Database schema
```

## Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run migrations
- `npm run db:studio` - Open Prisma Studio

### Adding New Features

1. Define the data model in `prisma/schema.prisma`
2. Run `npm run db:push` to update the database
3. Create route handlers in `src/routes/`
4. Update the main `src/index.js` to include new routes
5. Update the Capability Statement in `src/index.js`

## FHIR Compliance

This server implements FHIR R4 resources with:
- Proper HTTP status codes
- FHIR OperationOutcome for errors
- Bundle responses for search operations
- Resource versioning support
- Audit logging capabilities

## Security Features

- Helmet.js for security headers
- CORS configuration
- Rate limiting middleware
- Input validation
- Error handling without information leakage

## Future Enhancements

- Authentication and authorization
- ICD-11 API integration
- Advanced search and filtering
- Caching layer
- API documentation with Swagger
- Performance monitoring
- Backup and recovery procedures

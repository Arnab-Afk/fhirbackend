# FHIR API Quick Reference

## Base URL
```
http://localhost:3000/fhir
```

## Required Headers
```http
Accept: application/json
Content-Type: application/json
```

---

## CodeSystem Operations

### Core CRUD
- `GET /fhir/CodeSystem` - Search CodeSystems
- `GET /fhir/CodeSystem/{id}` - Read CodeSystem
- `POST /fhir/CodeSystem` - Create CodeSystem
- `PUT /fhir/CodeSystem/{id}` - Update CodeSystem
- `DELETE /fhir/CodeSystem/{id}` - Delete CodeSystem

### FHIR Operations
- `POST /fhir/CodeSystem/{id}/$lookup` - Lookup code details
- `POST /fhir/CodeSystem/{id}/$validate-code` - Validate code exists

---

## ConceptMap Operations

### Core CRUD
- `GET /fhir/ConceptMap` - Search ConceptMaps
- `GET /fhir/ConceptMap/{id}` - Read ConceptMap
- `POST /fhir/ConceptMap` - Create ConceptMap
- `PUT /fhir/ConceptMap/{id}` - Update ConceptMap
- `DELETE /fhir/ConceptMap/{id}` - Delete ConceptMap

### FHIR Operations
- `POST /fhir/ConceptMap/{id}/$translate` - Translate codes between systems
- `POST /fhir/ConceptMap/{id}/$validate` - Validate concept mapping

---

## ValueSet Operations

### Core CRUD
- `GET /fhir/ValueSet` - Search ValueSets
- `GET /fhir/ValueSet/{id}` - Read ValueSet
- `POST /fhir/ValueSet` - Create ValueSet
- `PUT /fhir/ValueSet/{id}` - Update ValueSet
- `DELETE /fhir/ValueSet/{id}` - Delete ValueSet

### FHIR Operations
- `GET /fhir/ValueSet/{id}/$expand` - Expand ValueSet concepts
- `GET /fhir/ValueSet/{id}/$validate-code` - Validate code in ValueSet

---

## Other Resources

### Condition
- `GET /fhir/Condition` - Search conditions
- `GET /fhir/Condition/{id}` - Read condition
- `POST /fhir/Condition` - Create condition
- `PUT /fhir/Condition/{id}` - Update condition
- `DELETE /fhir/Condition/{id}` - Delete condition

### Patient
- `GET /fhir/Patient` - Search patients
- `GET /fhir/Patient/{id}` - Read patient
- `POST /fhir/Patient` - Create patient
- `PUT /fhir/Patient/{id}` - Update patient
- `DELETE /fhir/Patient/{id}` - Delete patient

### AuditEvent
- `GET /fhir/AuditEvent` - Search audit events
- `GET /fhir/AuditEvent/{id}` - Read audit event
- `POST /fhir/AuditEvent` - Create audit event
- `PUT /fhir/AuditEvent/{id}` - Update audit event
- `DELETE /fhir/AuditEvent/{id}` - Delete audit event

---

## System Endpoints

- `GET /health` - Health check
- `GET /fhir/metadata` - Capability statement

---

## TM2 Integration Examples

### 1. Validate TM2 Code
```bash
curl -X POST "http://localhost:3000/fhir/CodeSystem/cmfcyyugq0007srbpohh1o7s9/\$validate-code" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"parameter":[{"name":"code","valueCode":"TM26.0"}]}'
```

### 2. Translate NAMASTE to ICD-11 TM2
```bash
curl -X POST "http://localhost:3000/fhir/ConceptMap/cmfczxkcw0000pau5h8g5h76g/\$translate" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"parameter":[{"name":"code","valueCode":"SR11"},{"name":"system","valueUri":"https://ayush.gov.in/fhir/CodeSystem/namaste"}]}'
```

### 3. Lookup Code Details
```bash
curl -X POST "http://localhost:3000/fhir/CodeSystem/cmfcyyugq0007srbpohh1o7s9/\$lookup" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"parameter":[{"name":"code","valueCode":"TM26.0"}]}'
```

---

## Key CodeSystem IDs

- **ICD-11 TM2:** `cmfcyyugq0007srbpohh1o7s9`
- **NAMASTE:** `cmfcyytj10000srbp2as56xqh`
- **Unani:** `cmfcz4ytd0000q19ju46acvl3`

---

## Test Scripts

```bash
# Run all tests
node scripts/testAllEndpoints.js

# Test TM2 functionality
node scripts/testTM2Validation.js
```

---

## Response Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `404` - Not Found
- `406` - Not Acceptable
- `415` - Unsupported Media Type
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

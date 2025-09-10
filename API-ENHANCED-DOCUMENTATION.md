# NAMASTE & ICD-11 FHIR Backend API Documentation

## Overview

This FHIR R4-compliant backend provides integration between India's NAMASTE terminologies and WHO ICD-11 (Traditional Medicine Module 2 & Biomedicine) for Electronic Medical Record (EMR) systems. The service enables dual-coding for traditional medicine diagnoses and supports interoperability for analytics and insurance claims.

## Base URL
```
http://localhost:3000/fhir
```

## Authentication

The API uses API key authentication (without ABHA as requested):

```http
X-API-Key: your-api-key
```

Default API key for testing: `default-api-key`

## Core Features

### 1. Enhanced Terminology Services

#### Auto-complete Search
Smart search across multiple terminology systems with dual-coding support.

**Endpoint:** `GET /fhir/terminology/$autocomplete`

**Parameters:**
- `search` (required): Search term (minimum 2 characters)
- `system` (optional): Specific CodeSystem URL to search
- `systems` (optional): Comma-separated list of systems (`namaste,icd11-tm2,unani`)
- `language` (optional): Language preference (default: `en`)
- `limit` (optional): Maximum results (default: 20, max: 50)
- `includeDesignations` (optional): Include translations (default: true)
- `includeMappings` (optional): Include code mappings (default: true)

**Example:**
```bash
GET /fhir/terminology/$autocomplete?search=fever&systems=namaste,icd11-tm2&limit=10
```

**Response:**
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "result",
      "valueBoolean": true
    },
    {
      "name": "matches",
      "valueInteger": 5
    },
    {
      "name": "match",
      "part": [
        {
          "name": "index",
          "valueInteger": 0
        },
        {
          "name": "score",
          "valueDecimal": 95.0
        },
        {
          "name": "code",
          "valueCoding": {
            "system": "https://ayush.gov.in/fhir/CodeSystem/namaste",
            "code": "N001",
            "display": "Fever (Jwara)",
            "version": "1.0"
          }
        },
        {
          "name": "terminology",
          "valueString": "NAMASTE"
        },
        {
          "name": "mappings",
          "part": [
            {
              "name": "mapping",
              "part": [
                {
                  "name": "targetSystem",
                  "valueUri": "http://id.who.int/icd/release/11/mms"
                },
                {
                  "name": "targetCode",
                  "valueCode": "MD11.0"
                },
                {
                  "name": "targetDisplay",
                  "valueString": "Fever, unspecified"
                },
                {
                  "name": "equivalence",
                  "valueCode": "equivalent"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

#### Code Translation
Translate codes between NAMASTE and ICD-11 systems.

**Endpoint:** `POST /fhir/terminology/$translate`

**Request Body:**
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "code",
      "valueCode": "N001"
    },
    {
      "name": "system",
      "valueUri": "https://ayush.gov.in/fhir/CodeSystem/namaste"
    },
    {
      "name": "target",
      "valueUri": "http://id.who.int/icd/release/11/mms"
    }
  ]
}
```

#### Dual Code Lookup
Look up both NAMASTE and ICD-11 codes simultaneously.

**Endpoint:** `GET /fhir/terminology/$dual-code-lookup`

**Parameters:**
- `namasteCode` (optional): NAMASTE code to look up
- `icd11Code` (optional): ICD-11 code to look up
- `includeDetails` (optional): Include definitions and designations
- `includeHierarchy` (optional): Include parent/child relationships

**Example:**
```bash
GET /fhir/terminology/$dual-code-lookup?namasteCode=N001&includeDetails=true
```

### 2. Problem List Management

#### Create Problem List Entry
Create FHIR Condition resources with dual coding support.

**Endpoint:** `POST /fhir/problem-list`

**Request Body:**
```json
{
  "patientId": "patient-id-123",
  "namasteCode": "N001",
  "icd11Code": "MD11.0",
  "clinicalStatus": "active",
  "verificationStatus": "confirmed",
  "onset": {
    "dateTime": "2023-09-01T10:00:00Z"
  },
  "severity": {
    "code": "255604002",
    "display": "Mild"
  },
  "notes": "Patient presents with mild fever symptoms"
}
```

**Response:**
```json
{
  "resourceType": "Condition",
  "id": "condition-id-456",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2023-09-10T10:00:00Z",
    "profile": ["http://hl7.org/fhir/StructureDefinition/Condition"]
  },
  "clinicalStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
      "code": "active",
      "display": "active"
    }]
  },
  "verificationStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
      "code": "confirmed",
      "display": "confirmed"
    }]
  },
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-category",
      "code": "problem-list-item",
      "display": "Problem List Item"
    }]
  }],
  "code": {
    "coding": [
      {
        "system": "https://ayush.gov.in/fhir/CodeSystem/namaste",
        "code": "N001",
        "display": "Fever (Jwara)",
        "version": "1.0"
      },
      {
        "system": "http://id.who.int/icd/release/11/mms",
        "code": "MD11.0",
        "display": "Fever, unspecified",
        "version": "1.0"
      }
    ],
    "text": "Fever (Jwara)"
  },
  "subject": {
    "reference": "Patient/patient-id-123",
    "display": "Rajesh Kumar Sharma"
  },
  "recordedDate": "2023-09-10T10:00:00Z"
}
```

#### Get Patient Problem List
Retrieve all problem list entries for a patient.

**Endpoint:** `GET /fhir/problem-list/{patientId}`

**Parameters:**
- `status` (optional): Filter by clinical status (`active`, `resolved`, etc.)
- `_count` (optional): Number of results (default: 20)
- `_offset` (optional): Offset for pagination (default: 0)

#### Get Problem List Summary
Get analytics and summary for a patient's problem list.

**Endpoint:** `GET /fhir/problem-list/{patientId}/summary`

### 3. Standard FHIR Resources

#### CodeSystem Operations

**Search CodeSystems:**
```bash
GET /fhir/CodeSystem?name=NAMASTE&status=active
```

**Read CodeSystem:**
```bash
GET /fhir/CodeSystem/{id}
```

**Code Lookup:**
```bash
POST /fhir/CodeSystem/{id}/$lookup
```

**Code Validation:**
```bash
POST /fhir/CodeSystem/{id}/$validate-code
```

**Auto-complete (CodeSystem specific):**
```bash
GET /fhir/CodeSystem/$autocomplete?system=https://ayush.gov.in/fhir/CodeSystem/namaste&search=fever
```

#### ConceptMap Operations

**Search ConceptMaps:**
```bash
GET /fhir/ConceptMap?source=https://ayush.gov.in/fhir/CodeSystem/namaste
```

**Translate codes:**
```bash
POST /fhir/ConceptMap/{id}/$translate
```

**Validate mapping:**
```bash
POST /fhir/ConceptMap/{id}/$validate
```

#### Bundle Processing

Process transaction bundles with dual-coding support.

**Endpoint:** `POST /fhir/Bundle`

**Example Bundle:**
```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "active": true,
        "name": [{
          "use": "official",
          "family": "Sharma",
          "given": ["Rajesh"]
        }],
        "gender": "male"
      },
      "request": {
        "method": "POST",
        "url": "Patient"
      }
    },
    {
      "resource": {
        "resourceType": "Condition",
        "clinicalStatus": {
          "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
            "code": "active"
          }]
        },
        "code": {
          "coding": [
            {
              "system": "https://ayush.gov.in/fhir/CodeSystem/namaste",
              "code": "N001",
              "display": "Fever (Jwara)"
            },
            {
              "system": "http://id.who.int/icd/release/11/mms",
              "code": "MD11.0",
              "display": "Fever, unspecified"
            }
          ]
        },
        "subject": {
          "reference": "Patient/patient-temp-id"
        }
      },
      "request": {
        "method": "POST",
        "url": "Condition"
      }
    }
  ]
}
```

### 4. Supported Code Systems

#### NAMASTE
- **URL:** `https://ayush.gov.in/fhir/CodeSystem/namaste`
- **Description:** National AYUSH Morbidity & Standardized Terminologies Electronic
- **Concepts:** ~3,490 Ayurveda, Siddha, Unani disorders
- **Languages:** Sanskrit (Devanagari), English, Tamil

#### Unani
- **URL:** `https://ayush.gov.in/fhir/CodeSystem/unani`
- **Description:** Unani Medicine Terminology
- **Concepts:** ~338 Unani medical terms
- **Languages:** Arabic, English

#### ICD-11 TM2
- **URL:** `http://id.who.int/icd/release/11/mms`
- **Description:** WHO ICD-11 Traditional Medicine Module 2
- **Concepts:** ~646 traditional medicine disorders and patterns
- **Languages:** English

#### ICD-11 Biomedicine
- **URL:** `https://icd.who.int/browse11/l-m/en`
- **Description:** WHO ICD-11 Biomedicine
- **Languages:** English

### 5. ConceptMaps Available

1. **NAMASTE to ICD-11 TM2**
   - Source: `https://ayush.gov.in/fhir/CodeSystem/namaste`
   - Target: `http://id.who.int/icd/release/11/mms`

2. **Unani to ICD-11 TM2**
   - Source: `https://ayush.gov.in/fhir/CodeSystem/unani`
   - Target: `http://id.who.int/icd/release/11/mms`

### 6. Compliance Features

#### India's 2016 EHR Standards
- ✅ FHIR R4 compliance
- ✅ Audit trails for all operations
- ✅ Version tracking and metadata
- ✅ OAuth 2.0 ready (API key for now)
- ✅ Structured terminology management

#### FHIR Capability Statement
**Endpoint:** `GET /fhir/metadata`

Returns detailed capability statement with supported resources, operations, and search parameters.

### 7. Error Handling

All errors follow FHIR OperationOutcome format:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "not-found",
    "details": {
      "text": "Resource Patient/123 not found"
    }
  }]
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid API key)
- `404` - Not Found
- `500` - Internal Server Error

### 8. Rate Limiting

- Default: 100 requests per 15 minutes
- Configurable via environment variables
- Returns `429 Too Many Requests` when exceeded

### 9. Health Check

**Endpoint:** `GET /health`

Returns server status and timestamp:

```json
{
  "status": "healthy",
  "timestamp": "2023-09-10T10:00:00Z",
  "version": "1.0.0",
  "service": "AyushBridge FHIR Backend"
}
```

## Running the Demo

Execute the demo script to test all functionality:

```bash
node scripts/demo.js
```

This demonstrates:
- Server connectivity
- Auto-complete search
- Code system browsing
- Dual-code lookup
- Patient creation
- Multi-system search
- FHIR capability testing

## Environment Variables

```env
DATABASE_URL=postgresql://...
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
JWT_SECRET=your-secret-key
VALID_API_KEYS=default-api-key,another-key
```

## Data Model

The service supports:
- **4,474 total concepts** across all code systems
- **3 ConceptMaps** for cross-system translation
- **Multilingual support** (Sanskrit, Tamil, Arabic, English)
- **Hierarchical relationships** within terminologies
- **Dual-coding validation** for problem list entries

This backend enables EMR vendors to implement compliant dual-coding workflows that satisfy India's EHR standards while supporting traditional medicine integration with global ICD-11 reporting.

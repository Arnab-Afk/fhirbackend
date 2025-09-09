# FHIR R4 Backend API Documentation

## Overview

This FHIR R4 compliant backend provides comprehensive terminology services for integrating NAMASTE and ICD-11 TM2 terminologies into Electronic Medical Record (EMR) systems. It enables dual-coding of traditional medicine diagnoses with modern healthcare standards.

**Base URL:** `http://localhost:3000/fhir`  
**Version:** FHIR R4  
**Content-Type:** `application/json` or `application/fhir+json`  
**Accept:** `application/json` or `application/fhir+json`

## Authentication

Currently, no authentication is required for development/testing purposes.

## Common Headers

```http
Accept: application/json
Content-Type: application/json
```

## Error Responses

All errors follow FHIR OperationOutcome format:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "not-found",
      "details": {
        "text": "Resource not found"
      }
    }
  ]
}
```

## HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content (for DELETE)
- `400` - Bad Request
- `404` - Not Found
- `406` - Not Acceptable (invalid Accept header)
- `415` - Unsupported Media Type (invalid Content-Type)
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

---

# CodeSystem Resource

CodeSystem resources contain sets of codes and their meanings for use in healthcare applications.

## CRUD Operations

### Search CodeSystems

**GET** `/fhir/CodeSystem`

**Query Parameters:**
- `url` - Canonical URL of the CodeSystem
- `version` - Version of the CodeSystem
- `name` - Name of the CodeSystem (case-insensitive)
- `status` - Status (active, draft, retired)
- `_count` - Number of results (default: 20)
- `_offset` - Pagination offset (default: 0)

**Example Request:**
```bash
curl -X GET "http://localhost:3000/fhir/CodeSystem?name=ICD11-TM2" \
  -H "Accept: application/json"
```

**Response:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 1,
  "entry": [
    {
      "resource": {
        "resourceType": "CodeSystem",
        "id": "cmfcyyugq0007srbpohh1o7s9",
        "url": "http://id.who.int/icd/release/11/mms",
        "name": "ICD11-TM2",
        "title": "ICD-11 Traditional Medicine Module 2",
        "status": "active",
        "count": 646,
        "concept": [...]
      }
    }
  ]
}
```

### Read CodeSystem

**GET** `/fhir/CodeSystem/{id}`

**Example Request:**
```bash
curl -X GET "http://localhost:3000/fhir/CodeSystem/cmfcyyugq0007srbpohh1o7s9" \
  -H "Accept: application/json"
```

### Create CodeSystem

**POST** `/fhir/CodeSystem`

**Request Body:**
```json
{
  "resourceType": "CodeSystem",
  "url": "https://example.com/codesystem",
  "name": "Example CodeSystem",
  "title": "Example Terminology",
  "status": "active",
  "content": "complete",
  "concept": [
    {
      "code": "EXAMPLE001",
      "display": "Example Concept",
      "definition": "An example concept"
    }
  ]
}
```

### Update CodeSystem

**PUT** `/fhir/CodeSystem/{id}`

### Delete CodeSystem

**DELETE** `/fhir/CodeSystem/{id}`

## FHIR Operations

### $lookup - Lookup Code Information

**POST** `/fhir/CodeSystem/{id}/$lookup`

**Request Body:**
```json
{
  "parameter": [
    {
      "name": "code",
      "valueCode": "TM26.0"
    },
    {
      "name": "system",
      "valueUri": "http://id.who.int/icd/release/11/mms"
    },
    {
      "name": "display",
      "valueString": "Disorders of vata dosha"
    },
    {
      "name": "property",
      "valueCode": "parent"
    }
  ]
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/fhir/CodeSystem/cmfcyyugq0007srbpohh1o7s9/\$lookup" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"parameter":[{"name":"code","valueCode":"TM26.0"}]}'
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
      "name": "name",
      "valueString": "ICD11-TM2"
    },
    {
      "name": "display",
      "valueString": "Disorders of vata dosha"
    },
    {
      "name": "code",
      "valueCode": "TM26.0"
    },
    {
      "name": "system",
      "valueUri": "http://id.who.int/icd/release/11/mms"
    }
  ]
}
```

### $validate-code - Validate Code

**POST** `/fhir/CodeSystem/{id}/$validate-code`

**Request Body:**
```json
{
  "parameter": [
    {
      "name": "code",
      "valueCode": "TM26.0"
    },
    {
      "name": "display",
      "valueString": "Disorders of vata dosha"
    }
  ]
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/fhir/CodeSystem/cmfcyyugq0007srbpohh1o7s9/\$validate-code" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"parameter":[{"name":"code","valueCode":"TM26.0"}]}'
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
      "name": "code",
      "valueCode": "TM26.0"
    },
    {
      "name": "system",
      "valueUri": "http://id.who.int/icd/release/11/mms"
    },
    {
      "name": "display",
      "valueString": "Disorders of vata dosha"
    }
  ]
}
```

---

# ConceptMap Resource

ConceptMap resources define mappings between concepts in different CodeSystems.

## CRUD Operations

### Search ConceptMaps

**GET** `/fhir/ConceptMap`

**Query Parameters:**
- `url` - Canonical URL
- `version` - Version
- `name` - Name (case-insensitive)
- `status` - Status
- `source` - Source CodeSystem URL
- `target` - Target CodeSystem URL
- `_count` - Number of results (default: 20)
- `_offset` - Pagination offset (default: 0)

### Read ConceptMap

**GET** `/fhir/ConceptMap/{id}`

### Create ConceptMap

**POST** `/fhir/ConceptMap`

### Update ConceptMap

**PUT** `/fhir/ConceptMap/{id}`

### Delete ConceptMap

**DELETE** `/fhir/ConceptMap/{id}`

## FHIR Operations

### $translate - Translate Codes

**POST** `/fhir/ConceptMap/{id}/$translate`

**Request Body:**
```json
{
  "parameter": [
    {
      "name": "code",
      "valueCode": "SR11"
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

**Example Request:**
```bash
curl -X POST "http://localhost:3000/fhir/ConceptMap/cmfczxkcw0000pau5h8g5h76g/\$translate" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"parameter":[{"name":"code","valueCode":"SR11"},{"name":"system","valueUri":"https://ayush.gov.in/fhir/CodeSystem/namaste"}]}'
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
      "name": "match",
      "part": [
        {
          "name": "equivalence",
          "valueCode": "equivalent"
        },
        {
          "name": "concept",
          "valueCoding": {
            "system": "http://id.who.int/icd/release/11/mms",
            "code": "TM26.0",
            "display": "Disorders of vata dosha"
          }
        }
      ]
    }
  ]
}
```

### $validate - Validate Concept Mapping

**POST** `/fhir/ConceptMap/{id}/$validate`

**Request Body:**
```json
{
  "parameter": [
    {
      "name": "source",
      "valueUri": "https://ayush.gov.in/fhir/CodeSystem/namaste"
    },
    {
      "name": "target",
      "valueUri": "http://id.who.int/icd/release/11/mms"
    },
    {
      "name": "concept",
      "valueCoding": {
        "code": "SR11",
        "system": "https://ayush.gov.in/fhir/CodeSystem/namaste"
      }
    }
  ]
}
```

---

# ValueSet Resource

ValueSet resources define collections of codes from one or more CodeSystems.

## CRUD Operations

### Search ValueSets

**GET** `/fhir/ValueSet`

### Read ValueSet

**GET** `/fhir/ValueSet/{id}`

### Create ValueSet

**POST** `/fhir/ValueSet`

### Update ValueSet

**PUT** `/fhir/ValueSet/{id}`

### Delete ValueSet

**DELETE** `/fhir/ValueSet/{id}`

## FHIR Operations

### $expand - Expand ValueSet

**GET** `/fhir/ValueSet/{id}/$expand`

**Query Parameters:**
- `filter` - Filter concepts by display text
- `count` - Maximum number of concepts to return
- `offset` - Pagination offset

**Example Request:**
```bash
curl -X GET "http://localhost:3000/fhir/ValueSet/{id}/\$expand?filter=vata" \
  -H "Accept: application/json"
```

**Response:**
```json
{
  "resourceType": "ValueSet",
  "id": "example-valueset",
  "url": "https://example.com/valueset",
  "expansion": {
    "timestamp": "2025-09-10T10:00:00.000Z",
    "total": 1,
    "contains": [
      {
        "system": "http://id.who.int/icd/release/11/mms",
        "code": "TM26.0",
        "display": "Disorders of vata dosha"
      }
    ]
  }
}
```

### $validate-code - Validate Code in ValueSet

**GET** `/fhir/ValueSet/{id}/$validate-code`

**Query Parameters:**
- `code` - Code to validate (required)
- `system` - CodeSystem URL
- `display` - Expected display text

**Example Request:**
```bash
curl -X GET "http://localhost:3000/fhir/ValueSet/{id}/\$validate-code?code=TM26.0" \
  -H "Accept: application/json"
```

---

# Condition Resource

Condition resources represent health conditions or problems.

## CRUD Operations

### Search Conditions

**GET** `/fhir/Condition`

**Query Parameters:**
- `patient` - Patient ID
- `code` - Condition code
- `clinical-status` - Clinical status
- `verification-status` - Verification status
- `_count` - Number of results
- `_offset` - Pagination offset

### Read Condition

**GET** `/fhir/Condition/{id}`

### Create Condition

**POST** `/fhir/Condition`

**Request Body:**
```json
{
  "resourceType": "Condition",
  "subject": {
    "reference": "Patient/example-patient-id"
  },
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
  },
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
        "code": "active"
      }
    ]
  }
}
```

### Update Condition

**PUT** `/fhir/Condition/{id}`

### Delete Condition

**DELETE** `/fhir/Condition/{id}`

---

# Patient Resource

Patient resources represent individuals receiving healthcare.

## CRUD Operations

### Search Patients

**GET** `/fhir/Patient`

**Query Parameters:**
- `name` - Patient name
- `identifier` - Patient identifier
- `birthdate` - Date of birth
- `_count` - Number of results
- `_offset` - Pagination offset

### Read Patient

**GET** `/fhir/Patient/{id}`

### Create Patient

**POST** `/fhir/Patient`

### Update Patient

**PUT** `/fhir/Patient/{id}`

### Delete Patient

**DELETE** `/fhir/Patient/{id}`

---

# AuditEvent Resource

AuditEvent resources record security-relevant events.

## CRUD Operations

### Search AuditEvents

**GET** `/fhir/AuditEvent`

**Query Parameters:**
- `date` - Event date
- `type` - Event type
- `action` - Event action
- `agent` - Agent involved
- `_count` - Number of results
- `_offset` - Pagination offset

### Read AuditEvent

**GET** `/fhir/AuditEvent/{id}`

### Create AuditEvent

**POST** `/fhir/AuditEvent`

### Update AuditEvent

**PUT** `/fhir/AuditEvent/{id}`

### Delete AuditEvent

**DELETE** `/fhir/AuditEvent/{id}`

---

# System Endpoints

## Health Check

**GET** `/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-09-10T10:00:00.000Z",
  "version": "1.0.0"
}
```

## Capability Statement

**GET** `/fhir/metadata`

Returns the FHIR server's capability statement with supported resources and operations.

---

# TM2 Integration Examples

## Dual-Coding a Traditional Medicine Diagnosis

1. **Validate NAMASTE Code:**
```bash
curl -X POST "http://localhost:3000/fhir/CodeSystem/namaste-codesystem-id/\$validate-code" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"parameter":[{"name":"code","valueCode":"SR11"}]}'
```

2. **Translate to ICD-11 TM2:**
```bash
curl -X POST "http://localhost:3000/fhir/ConceptMap/namaste-to-icd11-mapping-id/\$translate" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"parameter":[{"name":"code","valueCode":"SR11"},{"name":"system","valueUri":"https://ayush.gov.in/fhir/CodeSystem/namaste"}]}'
```

3. **Create Condition with Dual Coding:**
```bash
curl -X POST "http://localhost:3000/fhir/Condition" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceType": "Condition",
    "subject": {"reference": "Patient/patient-id"},
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
  }'
```

---

# Available CodeSystems

## ICD-11 TM2
- **ID:** `cmfcyyugq0007srbpohh1o7s9`
- **URL:** `http://id.who.int/icd/release/11/mms`
- **Concepts:** 646 TM2 codes
- **Example:** `TM26.0` - "Disorders of vata dosha"

## NAMASTE
- **ID:** `cmfcyytj10000srbp2as56xqh`
- **URL:** `https://ayush.gov.in/fhir/CodeSystem/namaste`
- **Concepts:** 3,490 traditional medicine terms
- **Example:** `SR11` - "वातसञ्चयः"

## Unani
- **ID:** `cmfcz4ytd0000q19ju46acvl3`
- **URL:** `https://ayush.gov.in/fhir/CodeSystem/unani`
- **Concepts:** 338 Unani medicine terms
- **Example:** `A-2` - "شقيقہ"

---

# Testing Scripts

Run the comprehensive test suite:

```bash
# Test all endpoints
node scripts/testAllEndpoints.js

# Test TM2 specific functionality
node scripts/testTM2Validation.js
```

---

# Notes

- All endpoints require proper FHIR headers (`Accept` and `Content-Type`)
- Responses follow FHIR R4 resource formats
- Error responses use FHIR OperationOutcome format
- Pagination is supported with `_count` and `_offset` parameters
- All TM2 operations are fully functional for EMR integration
- Database contains sample data for testing all operations

For additional support or questions, refer to the test results in the `test-results/` directory.

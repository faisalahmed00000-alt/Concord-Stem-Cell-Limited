# Security Specification: Patient Records Ledger

This document outlines the security specifications, data invariants, and the "Dirty Dozen" threat-model payloads for the Electronic Health Records (EHR) ledger, ensuring zero-trust integrity.

## 1. Data Invariants

### 1.1 Patient Record (`Patient`)
- **Immutability**: `id` and `createdAt` must remain unmodified after creation.
- **Identity Integrity**: No anonymous changes can overwrite patient records.
- **Strict Size/Type Enforcements**:
  - `id`: `string`, size <= 128 characters, matching pattern `^[a-zA-Z0-9_\-]+$`.
  - `code`: `string`, size <= 64 characters.
  - `name`: `string`, size <= 256 characters (encrypted zero-knowledge ciphertext).
  - `diagnosis`: `string`, size <= 256 characters.
  - `consultant`: `string`, size <= 256 characters.
  - `treatment`: `string`, size <= 256 characters.
  - `createdAt`: `string`, size <= 64 characters.

### 1.2 Clinician (`Clinician`)
- **Structure**:
  - `username`: `string`, non-empty, size <= 128 characters.
  - `fullName`: `string`, size <= 256 characters.
  - `role`: Must be one of `admin`, `co-admin`, or `user`.

### 1.3 System Settings (`SystemSettings`)
- **Structure**:
  - Contains array of items for drop-downs (`diagnoses`, `routes`, `procedurePlaces`, `consultants`, `treatments`, `recoveryStatuses`).
  - `theme`: `string` corresponding to custom theme options.

---

## 2. The "Dirty Dozen" Threat-Model Payloads

These payloads represent malicious schema injection, type spoofing, identity poisoning, and denial-of-wallet attempts designed to be blocked by the fortress rules.

### Payload 1: ID Poisoning (Massive String)
Attempt to inject a 1MB junk-character string as the document ID for Patient.
```json
{
  "path": "patients/PATIENT_ID_VERY_LONG_REPEATED_A...",
  "operation": "create",
  "data": { "id": "PATIENT_ID_VERY_LONG_REPEATED_A...", "code": "P-101", "name": "Encrypted", "diagnosis": "Migraine", "consultant": "Dr. Jenkins", "treatment": "Protocol", "createdAt": "2026-06-05T11:25:00Z" }
}
```

### Payload 2: Ghost Field / Shadow Update Attack
Attempting to inject a non-whitelisted attribute (`isVerifiedClinician: true`) during write.
```json
{
  "path": "patients/patient-1",
  "operation": "create",
  "data": { "id": "patient-1", "code": "P-101", "name": "Encrypted", "diagnosis": "Migraine", "consultant": "Dr. Jenkins", "treatment": "Protocol", "createdAt": "2026-06-05T11:25:00Z", "isVerifiedClinician": true }
}
```

### Payload 3: Role Escalation Attack
Attempt to register as a clinician with a self-assigned `role: "admin"`.
```json
{
  "path": "users/attacker",
  "operation": "create",
  "data": { "username": "attacker", "fullName": "Lord Attacker", "role": "admin" }
}
```

### Payload 4: Invalid Type Poisoning
Attempting to write an integer to a string-validated field (`name`).
```json
{
  "path": "patients/patient-2",
  "operation": "create",
  "data": { "id": "patient-2", "code": "P-102", "name": 9999999, "diagnosis": "Migraine", "consultant": "Dr. Jenkins", "treatment": "Protocol", "createdAt": "2026-06-05T11:25:00Z" }
}
```

### Payload 5: Missing Mandatory Fields
Attempting to create a patient record lacking core credentials.
```json
{
  "path": "patients/patient-3",
  "operation": "create",
  "data": { "id": "patient-3", "code": "P-103", "createdAt": "2026-06-05T11:25:00Z" }
}
```

### Payload 6: Immutability Violation on Update
Attempting to alter the immutable `createdAt` timestamp.
```json
{
  "path": "patients/patient-1",
  "operation": "update",
  "data": { "id": "patient-1", "code": "P-101", "name": "Encrypted", "diagnosis": "Migraine", "consultant": "Dr. Jenkins", "treatment": "Protocol", "createdAt": "2020-01-01T00:00:00Z" }
}
```

### Payload 7: Denial of Wallet (Size Exhaustion)
Writing extremely large arrays to system settings parameters.
```json
{
  "path": "settings/global",
  "operation": "update",
  "data": { "diagnoses": ["very large item repeating...", "..."] }
}
```

### Payload 8: Path Character Invalidation
Attempting to write with complex special characters in the document path ID.
```json
{
  "path": "patients/pat#$%-12",
  "operation": "create",
  "data": { "id": "pat#$%-12", "code": "P-101", "name": "Encrypted", "diagnosis": "Migraine", "consultant": "Dr. Jenkins", "treatment": "Protocol", "createdAt": "2026-06-05T11:25:00Z" }
}
```

### Payload 9: Invalid Enum Value Registration
Registering a clinician with an unsupported role type like `"superagent"`.
```json
{
  "path": "users/user-5",
  "operation": "create",
  "data": { "username": "user-5", "fullName": "Fake Clinician", "role": "superagent" }
}
```

### Payload 10: Unauthorized Modification of Other Fields
A standard clinician attempting to modify system-protected setting collections without proper privilege alignment.
```json
{
  "path": "settings/global",
  "operation": "update",
  "data": { "theme": "hack-dark-inject" }
}
```

### Payload 11: Array Manipulation Attack
Attempting to inject lists containing non-string or mismatched elements into configuration states.
```json
{
  "path": "settings/global",
  "operation": "update",
  "data": { "diagnoses": [123, true, null] }
}
```

### Payload 12: Orphaned Follow-up Session Counter Out of Bounds
Creating follow-ups or changing session numbers to negative boundaries.
```json
{
  "path": "patients/patient-5",
  "operation": "update",
  "data": { "sessionNo": -50 }
}
```

---

## 3. The Test Runner Mock Specification

```typescript
// firestore.rules.test.ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe("Electronic Health Records Ledger: Security Rules", () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "glassy-monument-w6m9v",
      firestore: {
        host: "localhost",
        port: 8080,
      }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("should fail on a 1MB string injected as a patient ID (Payload 1)", async () => {
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
    const maliciousId = "A".repeat(1000 * 100); // 100KB+
    const docRef = unauthenticatedDb.collection("patients").doc(maliciousId);
    await assertFails(docRef.set({
      id: maliciousId,
      code: "P-101",
      name: "Cipher",
      diagnosis: "Intractable Pain",
      consultant: "Dr. Jenkins",
      treatment: "Protocol",
      createdAt: "2026-06-05T11:25:00Z"
    }));
  });

  it("should fail when extra Ghost Fields are present in write (Payload 2)", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const docRef = db.collection("patients").doc("pat-ok-1");
    await assertFails(docRef.set({
      id: "pat-ok-1",
      code: "P-101",
      name: "Cipher",
      diagnosis: "Migraine",
      consultant: "Dr. Jenkins",
      treatment: "Protocol",
      createdAt: "2026-06-05T11:25:00Z",
      isVerifiedClinician: true // ghost field
    }));
  });
});
```

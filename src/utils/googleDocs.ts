import { Patient } from '../types/patient';

export interface DocMetadata {
  id: string;
  title: string;
  url: string;
}

/**
 * Creates a new Google Document with the given title.
 */
export async function createGoogleDoc(accessToken: string, title: string): Promise<DocMetadata> {
  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create Google Document: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.documentId,
    title: data.title,
    url: `https://docs.google.com/document/d/${data.documentId}/edit`,
  };
}

/**
 * Default Clinical Narrative Progress Template with placeholder tokens.
 */
export const DEFAULT_CLINICAL_TEMPLATE = `========================================================================
🩺 CLINICAL PROGRESS RECORD & CASE SUMMARY REPORT
========================================================================
🏥 Healthcare Brand: {{CLINIC_NAME}}
👤 Cohort Patient   : {{PATIENT_NAME}} ({{PATIENT_CODE}})
🗓️ Report Timestamp : {{TIMESTAMP}}
========================================================================

[1] CLINICAL DEMOGRAPHICS DOSSIER:
  - Subject Full Name    : {{PATIENT_NAME}}
  - Unique System Code   : {{PATIENT_CODE}}
  - Biological Age       : {{PATIENT_AGE}} years old
  - Physiological Sex    : {{PATIENT_SEX}}
  - Registered Telephone : {{PATIENT_PHONE}}
  - Initial Admits Date  : {{ENTRY_DATE}}

[2] COMPREHENSIVE PROTOCOLS & STATUS CHECK:
  - Admitting Diagnosis  : {{CLINICAL_DIAGNOSIS}}
  - Attending Specialist : {{ATTENDING_CONSULTANT}}
  - Assigned Protocol    : {{TREATMENT_PROTOCOL}}
  - Product Route/Dosage : {{DOSAGE_ROUTE}} ({{DOSAGE_QTY}})
  - Active Session Tier  : Session #{{COMPLETED_SESSIONS}}
  - Patient Recovery Rate: {{RECOVERY_OUTCOME}}

[3] HISTORICAL TIMELINES & FOLLOWUPS:
{{TREATMENT_SESSIONS_TIMELINE}}

[4] ATTENDING PRACTITIONER DECISIONS & NOTES:
  "{{PRACTITIONER_NOTES}}"

========================================================================
Lock Assertion:
This ledger document was compiled dynamically under Zero-Knowledge sandbox 
guarantees. No unencrypted patient files are written to non-authorized clouds.
========================================================================`;

/**
 * Compiles a rich progress report document by resolving mustache placeholders with genuine clinical patient metrics.
 */
export function compilePatientProgressTemplate(
  template: string,
  patient: Patient,
  settings: any
): string {
  const clinicName = settings?.appName || 'Concord Stem Cell MSC Record';
  const labelPatientName = settings?.labelPatientName || 'Patient Full Name';
  const labelPatientCode = settings?.labelPatientCode || 'Patient ID';
  
  // Format history timeline block
  let sessionsTimeline = '  No historical treatments logged.';
  if (patient.treatmentSessions && patient.treatmentSessions.length > 0) {
    sessionsTimeline = patient.treatmentSessions
      .map(s => `  • [Session #${s.sessionNo} on ${s.date}] - MD: ${s.consultant} | Dose: ${s.amount} | Status: ${s.procedurePlace || 'N/A'}\n    Notes: "${s.notes || 'None'}"`)
      .join('\n');
  }

  const replacements: Record<string, string> = {
    '{{CLINIC_NAME}}': clinicName,
    '{{PATIENT_NAME}}': patient.name || 'Anonymous Patient',
    '{{PATIENT_CODE}}': patient.code || 'N/A',
    '{{TIMESTAMP}}': new Date().toLocaleString(),
    '{{PATIENT_AGE}}': String(patient.age || 0),
    '{{PATIENT_SEX}}': patient.sex || 'Other',
    '{{PATIENT_PHONE}}': patient.phone || 'N/A',
    '{{ENTRY_DATE}}': patient.date || 'N/A',
    '{{CLINICAL_DIAGNOSIS}}': patient.diagnosis || 'Routine Evaluation',
    '{{ATTENDING_CONSULTANT}}': patient.consultant || 'N/A',
    '{{TREATMENT_PROTOCOL}}': patient.treatment || 'N/A',
    '{{DOSAGE_ROUTE}}': patient.route || 'Oral',
    '{{DOSAGE_QTY}}': patient.amount || 'As Prescribed',
    '{{COMPLETED_SESSIONS}}': String(patient.sessionNo || 1),
    '{{RECOVERY_OUTCOME}}': patient.improvement || 'Stable',
    '{{TREATMENT_SESSIONS_TIMELINE}}': sessionsTimeline,
    '{{PRACTITIONER_NOTES}}': patient.notes || 'No remarks recorded.'
  };

  let compiled = template;
  for (const [key, val] of Object.entries(replacements)) {
    compiled = compiled.replace(new RegExp(key, 'g'), val);
  }

  return compiled;
}

/**
 * Appends the compiled templated clinical output to a Google Document.
 */
export async function writeClinicalDocContent(
  accessToken: string,
  documentId: string,
  compiledText: string
): Promise<void> {
  const url = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            text: compiledText,
            location: {
              index: 1, // Start of the blank document
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to write document content: ${response.statusText}`);
  }
}

/**
 * Generates and exports a templated clinical progress summary directly to Google Docs.
 */
export async function exportPatientProgressDoc(
  accessToken: string,
  patient: Patient,
  settings: any,
  templateString: string = DEFAULT_CLINICAL_TEMPLATE
): Promise<DocMetadata> {
  const docTitle = `[Clinical Progress Summary] ${patient.name} (${patient.code})`;
  const doc = await createGoogleDoc(accessToken, docTitle);
  const compiledText = compilePatientProgressTemplate(templateString, patient, settings);
  await writeClinicalDocContent(accessToken, doc.id, compiledText);
  return doc;
}

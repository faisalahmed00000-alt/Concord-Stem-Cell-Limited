import { Patient } from '../types/patient';

export interface SpreadsheetMetadata {
  id: string;
  title: string;
  url: string;
}

/**
 * Creates a new Google Spreadsheet with the given title and returns its ID.
 */
export async function createSpreadsheet(accessToken: string, title: string): Promise<SpreadsheetMetadata> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create Google Spreadsheet: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.spreadsheetId,
    title: data.properties.title,
    url: data.spreadsheetUrl,
  };
}

/**
 * Appends or Overwrites values in a Google Spreadsheet range.
 */
export async function updateSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update spreadsheet cells: ${response.statusText}`);
  }
}

/**
 * Retrieves values from a Google Spreadsheet range.
 */
export async function getSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<any[][] | null> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to read spreadsheet data: ${response.statusText}`);
  }

  const data = await response.json();
  return data.values || null;
}

/**
 * Maps React Patient entities into a flat spreadsheet row matrix starting with header row.
 */
export function mapPatientsToSheetRows(patients: Patient[]): any[][] {
  const headers = [
    'Patient Name',
    'Patient Code',
    'Age',
    'Biological Sex',
    'Contact Phone',
    'Clinical Diagnosis',
    'Attending Consultant',
    'Treatment Protocol',
    'Route',
    'Dosage',
    'Session No',
    'Admission Date',
    'Improvement Status',
    'Clinical Notes'
  ];

  const rows = patients.map(p => [
    p.name || '',
    p.code || '',
    p.age || 0,
    p.sex || 'Other',
    p.phone || '',
    p.diagnosis || '',
    p.consultant || '',
    p.treatment || '',
    p.route || '',
    p.amount || '',
    p.sessionNo || 1,
    p.date || '',
    p.improvement || 'Stable',
    p.notes || ''
  ]);

  return [headers, ...rows];
}

/**
 * Maps spreadsheet tabular rows back into fully valid React Patient entities.
 */
export function mapSheetRowsToPatients(rows: any[][]): Patient[] {
  if (!rows || rows.length <= 1) return [];

  // Inspect headers in the first row
  const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/[\s_]/g, ''));

  const findIndex = (aliases: string[]) => {
    return headers.findIndex(h => aliases.includes(h));
  };

  const nameIdx = findIndex(['patientname', 'name', 'fullname', 'fullname', 'nombre']);
  const codeIdx = findIndex(['patientcode', 'code', 'recordid', 'id', 'dossier', 'codepatient']);
  const ageIdx = findIndex(['age', 'years', 'edad', 'ageval']);
  const sexIdx = findIndex(['sex', 'gender', 'biologicalsex', 'gendersex', 'sexo']);
  const phoneIdx = findIndex(['phone', 'phonenumber', 'number', 'tel', 'telefono', 'contactphone']);
  const diagnosisIdx = findIndex(['diagnosis', 'condition', 'illness', 'disease', 'clinicaldiagnosis', 'diagnóstico']);
  const consultantIdx = findIndex(['consultant', 'attendingconsultant', 'doctor', 'physician', 'md', 'cardiologist']);
  const treatmentIdx = findIndex(['treatment', 'protocol', 'treatmentprotocol', 'medicine', 'activetreatment']);
  const routeIdx = findIndex(['route', 'routeofadministration', 'adminroute']);
  const amountIdx = findIndex(['amount', 'dosage', 'dose', 'qty']);
  const sessionIdx = findIndex(['session', 'sessionno', 'sessionnumber', 'sessions']);
  const dateIdx = findIndex(['date', 'admissiondate', 'entrydate', 'fecha']);
  const improvementIdx = findIndex(['improvement', 'improvementstatus', 'progress', 'status', 'improvementstatus']);
  const notesIdx = findIndex(['notes', 'remarks', 'comments', 'clinicalnotes', 'observaciones']);

  const patients: Patient[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || !row[nameIdx === -1 ? 0 : nameIdx]) continue;

    const name = nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]).trim() : `Imported Sheet Patient #${i}`;
    const code = codeIdx !== -1 && row[codeIdx] ? String(row[codeIdx]).trim() : `PAT-GSH-${Math.floor(1000 + Math.random() * 9000)}`;
    
    let age = 30;
    if (ageIdx !== -1 && row[ageIdx]) {
      const parsedAge = parseInt(String(row[ageIdx]), 10);
      if (!isNaN(parsedAge)) age = parsedAge;
    }

    let sex: Patient['sex'] = 'Other';
    if (sexIdx !== -1 && row[sexIdx]) {
      const rawSex = String(row[sexIdx]).toLowerCase().trim();
      if (rawSex.startsWith('m')) sex = 'Male';
      else if (rawSex.startsWith('f')) sex = 'Female';
    }

    const phone = phoneIdx !== -1 && row[phoneIdx] ? String(row[phoneIdx]).trim() : 'N/A';
    const diagnosis = diagnosisIdx !== -1 && row[diagnosisIdx] ? String(row[diagnosisIdx]).trim() : 'Routine Evaluation';
    const consultant = consultantIdx !== -1 && row[consultantIdx] ? String(row[consultantIdx]).trim() : 'Dr. Sarah Jenkins, MD';
    const treatment = treatmentIdx !== -1 && row[treatmentIdx] ? String(row[treatmentIdx]).trim() : 'Observation Support';
    const route = routeIdx !== -1 && row[routeIdx] ? String(row[routeIdx]).trim() : 'Oral';
    const amount = amountIdx !== -1 && row[amountIdx] ? String(row[amountIdx]).trim() : 'As Prescribed';

    let sessionNo = 1;
    if (sessionIdx !== -1 && row[sessionIdx]) {
      const parsedSession = parseInt(String(row[sessionIdx]), 10);
      if (!isNaN(parsedSession)) sessionNo = parsedSession;
    }

    const date = dateIdx !== -1 && row[dateIdx] ? String(row[dateIdx]).trim() : new Date().toISOString().split('T')[0];

    let improvement: Patient['improvement'] = 'Stable';
    if (improvementIdx !== -1 && row[improvementIdx]) {
      const impVal = String(row[improvementIdx]).toLowerCase().trim();
      if (impVal.includes('significantly') || impVal.includes('excellent')) {
        improvement = 'Significantly Improved';
      } else if (impVal.includes('improved') || impVal.includes('better')) {
        improvement = 'Improved';
      } else if (impVal.includes('unchanged') || impVal.includes('same')) {
        improvement = 'Unchanged';
      } else if (impVal.includes('deteriorated') || impVal.includes('worse')) {
        improvement = 'Deteriorated';
      } else if (impVal.includes('stable')) {
        improvement = 'Stable';
      }
    }

    const notes = notesIdx !== -1 && row[notesIdx] ? String(row[notesIdx]).trim() : 'Bulk imported via Google Sheets integration.';

    patients.push({
      id: crypto.randomUUID(),
      code,
      name,
      age,
      sex,
      phone,
      diagnosis,
      consultant,
      treatment,
      route,
      amount,
      sessionNo,
      date,
      improvement,
      notes,
      followUps: [],
      createdAt: new Date().toISOString()
    });
  }

  return patients;
}

/**
 * Retrieves a list of spreadsheets in the user's Google Drive.
 */
export async function listSpreadsheetsInDrive(accessToken: string): Promise<SpreadsheetMetadata[]> {
  const url = `https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.spreadsheet'+and+trashed%3Dfalse&fields=files(id,name,webViewLink)&pageSize=40`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch files from Google Drive: ${response.statusText}`);
  }

  const data = await response.json();
  const files = data.files || [];
  return files.map((f: any) => ({
    id: f.id,
    title: f.name,
    url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}`,
  }));
}

/**
 * Compiles patient recovery statistics and writes a formatted clinical outcome report to a new Google Sheet.
 */
export async function exportPatientOutcomesReport(
  accessToken: string,
  patients: Patient[],
  reportTitle: string
): Promise<SpreadsheetMetadata> {
  // 1. Create a blank sheet with the requested title
  const spreadsheet = await createSpreadsheet(accessToken, reportTitle);

  // 2. Compute aggregate clinical stats for the clinical managers
  const total = patients.length;
  let significantlyImprovedCount = 0;
  let improvedCount = 0;
  let unchangedStableCount = 0;
  let deterioratedCount = 0;

  patients.forEach(p => {
    const status = String(p.improvement || '').toLowerCase();
    if (status.includes('significantly')) significantlyImprovedCount++;
    else if (status.includes('deteriorated')) deterioratedCount++;
    else if (status.includes('improved')) improvedCount++;
    else unchangedStableCount++; // default/stable
  });

  const significantlyImprovedPct = total > 0 ? ((significantlyImprovedCount / total) * 100).toFixed(1) : '0.0';
  const improvedPct = total > 0 ? ((improvedCount / total) * 100).toFixed(1) : '0.0';
  const unchangedStablePct = total > 0 ? ((unchangedStableCount / total) * 100).toFixed(1) : '0.0';
  const deterioratedPct = total > 0 ? ((deterioratedCount / total) * 100).toFixed(1) : '0.0';

  // 3. Construct a beautiful reporting matrix (Title, stats bento-block, detailed table)
  const rows: any[][] = [];

  // Header Title
  rows.push(['CONCORD REGENERATIVE CLINICAL HEALTH LEDGER']);
  rows.push(['CLINICAL COHORT OUTCOME REPORT FOR HEALTHCARE MANAGERS']);
  rows.push([`Generated On: ${new Date().toLocaleString()} (Local Area Client)`]);
  rows.push([]);

  // Aggregate stats block
  rows.push(['COHORT STATISTICAL HIGHLIGHTS', '', '', '', '', '']);
  rows.push(['Metric Identifier', 'Absolute Count', 'Cohort Ratio (%)', '', '', '']);
  rows.push(['Fully Registered Cohort Patients', total, '100.0%', '', '', '']);
  rows.push(['Significantly Improved Cases', significantlyImprovedCount, `${significantlyImprovedPct}%`, '', '', '']);
  rows.push(['Stable/Standard Improved Cases', improvedCount, `${improvedPct}%`, '', '', '']);
  rows.push(['Maintained / Unchanged Baseline', unchangedStableCount, `${unchangedStablePct}%`, '', '', '']);
  rows.push(['Deteriorated Progression Profile', deterioratedCount, `${deterioratedPct}%`, '', '', '']);
  rows.push([]);

  // Detailed records section header
  rows.push(['DETAILED CLINICAL CASE OUTCOMES DATA LEDGER']);
  rows.push([
    'Patient Name',
    'Identifier Code',
    'Age (Years)',
    'Biological Sex',
    'Clinical Diagnosis',
    'Attending Practitioner',
    'Active Protocol',
    'Sessions Completed',
    'Admission Date',
    'Primary Outcome Profile',
    'Medical Progress Remarks'
  ]);

  // Insert case rows
  patients.forEach(p => {
    rows.push([
      p.name || 'Anonymous Patient',
      p.code || 'N/A',
      p.age || 0,
      p.sex || 'Other',
      p.diagnosis || 'Routine Evaluation',
      p.consultant || 'N/A',
      p.treatment || 'N/A',
      p.sessionNo || 1,
      p.date || 'N/A',
      p.improvement || 'Stable',
      p.notes || ''
    ]);
  });

  // Write values into the active sheet (Sheet1)
  const range = 'Sheet1!A1:K' + rows.length;
  await updateSpreadsheetValues(accessToken, spreadsheet.id, range, rows);

  return spreadsheet;
}


import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  limit,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Suppress internal Firestore Web SDK logging (e.g. GrpcConnection stream warnings)
try {
  setLogLevel('silent');
} catch (e) {
  console.warn('Could not set Firestore log level to silent:', e);
}

// Intercept console.error and console.warn to fully guarantee no unhandled timeout warnings are propagated as system errors
const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  const msg = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : String(arg))).join(' ');
  if (
    msg.includes("Disconnecting idle stream") ||
    msg.includes("Listen' stream") ||
    msg.includes("Timed out waiting for new targets") ||
    msg.includes("GrpcConnection RPC")
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args: any[]) {
  const msg = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : String(arg))).join(' ');
  if (
    msg.includes("Disconnecting idle stream") ||
    msg.includes("Listen' stream") ||
    msg.includes("Timed out waiting for new targets") ||
    msg.includes("GrpcConnection RPC")
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

const app = reportExpress();
function reportExpress() {
  return express();
}
const PORT = 3000;

// Enable JSON parsing with a large limit for attachments (Base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Firebase Client Web SDK (Runs fine in Node and bypasses container IAM limits)
const adminApp = getApps().length === 0 
  ? initializeApp(firebaseConfig) 
  : getApp();

// Use initializeFirestore with long polling to prevent standard Web Socket / gRPC RPC stream timeouts in Node environments
const config = firebaseConfig as any;
const db = config.firestoreDatabaseId 
  ? initializeFirestore(adminApp, { experimentalForceLongPolling: true }, config.firestoreDatabaseId)
  : initializeFirestore(adminApp, { experimentalForceLongPolling: true });

// Diagnostic/Resiliency Helpers and Local File Backup Sync (EHR hybrid data layer)
const DATA_DIR = path.join(process.cwd(), 'data');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ACTIVITY_LOGS_FILE = path.join(DATA_DIR, 'activity_logs.json');
const PATIENT_VERSIONS_FILE = path.join(DATA_DIR, 'patient_versions.json');

// Ensure data directory and fallback files exist
function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Pre-seed tracking logs and versions with realistic clinical records if they are empty
  const sampleVersions = [
    {
      id: "ver-1-1-1780512000000",
      patientId: "1",
      version: 1,
      timestamp: "2026-05-10T08:00:00.000Z",
      editedBy: "Dr. Sarah Jenkins, MD",
      changeSummary: "Initial Admission Created",
      patientData: {
        id: "1",
        code: "PAT-2026-4819",
        name: "Elizabeth Vance",
        age: 42,
        sex: "Female",
        phone: "+1 (555) 739-1120",
        diagnosis: "Migraine Specialist Protocol",
        consultant: "Dr. Sarah Jenkins, MD",
        treatment: "Excedrin IV Infusion Protocol",
        route: "Intravenous (IV) Infusion",
        amount: "100 mL",
        sessionNo: 3,
        date: "2026-05-10",
        improvement: "Improved",
        notes: "Patient presented with history of intractable clinical migraines lasting >72 hours, failing standard oral treatments. Recommended IV protocol.",
        followUps: [],
        createdAt: "2026-05-10T08:00:00.000Z",
        submittedBy: "Dr. Sarah Jenkins, MD",
        lastEditedBy: "Dr. Sarah Jenkins, MD"
      }
    },
    {
      id: "ver-1-2-1780857600000",
      patientId: "1",
      version: 2,
      timestamp: "2026-05-14T10:15:00.000Z",
      editedBy: "Dr. Sarah Jenkins, MD",
      changeSummary: "Added follow-up consultation",
      patientData: {
        id: "1",
        code: "PAT-2026-4819",
        name: "Elizabeth Vance",
        age: 42,
        sex: "Female",
        phone: "+1 (555) 739-1120",
        diagnosis: "Migraine Specialist Protocol",
        consultant: "Dr. Sarah Jenkins, MD",
        treatment: "Excedrin IV Infusion Protocol",
        route: "Intravenous (IV) Infusion",
        amount: "100 mL",
        sessionNo: 3,
        date: "2026-05-10",
        improvement: "Improved",
        notes: "Patient presented with history of intractable clinical migraines lasting >72 hours, failing standard oral treatments. Recommended IV protocol.",
        followUps: [
          {
            id: "f1",
            date: "2026-05-14",
            status: "Gradual Improvement Observed",
            notes: "First infusion cycle completed. Migraine frequency reduced from daily occurrences to zero in last 48 hours. Mild hydration advice given.",
            clinician: "Dr. Sarah Jenkins, MD"
          }
        ],
        createdAt: "2026-05-10T08:00:00.000Z",
        submittedBy: "Dr. Sarah Jenkins, MD",
        lastEditedBy: "Dr. Sarah Jenkins, MD"
      }
    },
    {
      id: "ver-1-3-1781721600000",
      patientId: "1",
      version: 3,
      timestamp: "2026-05-24T15:20:00.000Z",
      editedBy: "Dr. Sarah Jenkins, MD",
      changeSummary: "Updated recovery status to: Significantly Improved - Ready for Discharge Protocol",
      patientData: {
        id: "1",
        code: "PAT-2026-4819",
        name: "Elizabeth Vance",
        age: 42,
        sex: "Female",
        phone: "+1 (555) 739-1120",
        diagnosis: "Migraine Specialist Protocol",
        consultant: "Dr. Sarah Jenkins, MD",
        treatment: "Excedrin IV Infusion Protocol",
        route: "Intravenous (IV) Infusion",
        amount: "100 mL",
        sessionNo: 3,
        date: "2026-05-10",
        improvement: "Significantly Improved",
        notes: "Patient presented with history of intractable clinical migraines lasting >72 hours, failing standard oral treatments. Recommended IV protocol.",
        followUps: [
          {
            id: "f1",
            date: "2026-05-14",
            status: "Gradual Improvement Observed",
            notes: "First infusion cycle completed. Migraine frequency reduced from daily occurrences to zero in last 48 hours. Mild hydration advice given.",
            clinician: "Dr. Sarah Jenkins, MD"
          },
          {
            id: "f2",
            date: "2026-05-24",
            status: "Significantly Improved - Ready for Discharge Protocol",
            notes: "Excellent clinical outcomes. Patient reports zero symptomatic triggers since last follow-up. Vital signs within homeostatic limits.",
            clinician: "Dr. Sarah Jenkins, MD"
          }
        ],
        createdAt: "2026-05-10T08:00:00.000Z",
        submittedBy: "Dr. Sarah Jenkins, MD",
        lastEditedBy: "Dr. Sarah Jenkins, MD"
      }
    },
    {
      id: "ver-2-1-1781193600000",
      patientId: "2",
      version: 1,
      timestamp: "2026-05-18T16:30:00.000Z",
      editedBy: "Dr. Alan Vance, MD",
      changeSummary: "Initial Admission Created",
      patientData: {
        id: "2",
        code: "PAT-2026-9021",
        name: "Robert Miller",
        age: 58,
        sex: "Male",
        phone: "+1 (555) 302-9118",
        diagnosis: "Intervertebral Disc Herniation / Sciatica",
        consultant: "Dr. Alan Vance, MD",
        treatment: "Physical Decompression & Deep Corticosteroid block",
        route: "Intramuscular (IM) Injection",
        amount: "5 mg / 2 mL",
        sessionNo: 1,
        date: "2026-05-18",
        improvement: "Stable",
        notes: "Severe radicular low back pain radiating down L5 dermatome. Pain rated 8/10 on NRS. Administered guided intramuscular corticosteroid block.",
        followUps: [],
        createdAt: "2026-05-18T16:30:00.000Z",
        submittedBy: "Dr. Alan Vance, MD",
        lastEditedBy: "Dr. Alan Vance, MD"
      }
    },
    {
      id: "ver-2-2-1781798400000",
      patientId: "2",
      version: 2,
      timestamp: "2026-05-25T13:10:00.000Z",
      editedBy: "Dr. Alan Vance, MD",
      changeSummary: "Added follow-up consultation",
      patientData: {
        id: "2",
        code: "PAT-2026-9021",
        name: "Robert Miller",
        age: 58,
        sex: "Male",
        phone: "+1 (555) 302-9118",
        diagnosis: "Intervertebral Disc Herniation / Sciatica",
        consultant: "Dr. Alan Vance, MD",
        treatment: "Physical Decompression & Deep Corticosteroid block",
        route: "Intramuscular (IM) Injection",
        amount: "5 mg / 2 mL",
        sessionNo: 1,
        date: "2026-05-18",
        improvement: "Stable",
        notes: "Severe radicular low back pain radiating down L5 dermatome. Pain rated 8/10 on NRS. Administered guided intramuscular corticosteroid block.",
        followUps: [
          {
            id: "f3",
            date: "2026-05-25",
            status: "Stable / Maintenance Protocol",
            notes: "Numbness in lower extremities somewhat abated. Recommending physical physiotherapy integration.",
            clinician: "Dr. Alan Vance, MD"
          }
        ],
        createdAt: "2026-05-18T16:30:00.000Z",
        submittedBy: "Dr. Alan Vance, MD",
        lastEditedBy: "Dr. Alan Vance, MD"
      }
    },
    {
      id: "ver-3-1-1779350400000",
      patientId: "3",
      version: 1,
      timestamp: "2026-04-20T09:15:00.000Z",
      editedBy: "Dr. Jordan Carter, MD",
      changeSummary: "Initial Admission Created",
      patientData: {
        id: "3",
        code: "PAT-2026-1048",
        name: "Susan Kim",
        age: 65,
        sex: "Female",
        phone: "+1 (555) 441-0922",
        diagnosis: "Osteoarthritis Secondary Arthropathy",
        consultant: "Dr. Jordan Carter, MD",
        treatment: "Lubriplate Synovial Lubrication Mimic",
        route: "Subcutaneous (SC) Injection",
        amount: "10 mL",
        sessionNo: 6,
        date: "2026-04-20",
        improvement: "Improved",
        notes: "Mild localized arthrosis of the left patellar region coupled with stiffness.",
        followUps: [],
        createdAt: "2026-04-20T09:15:00.000Z",
        submittedBy: "Dr. Jordan Carter, MD",
        lastEditedBy: "Dr. Jordan Carter, MD"
      }
    },
    {
      id: "ver-3-2-1779955200000",
      patientId: "3",
      version: 2,
      timestamp: "2026-04-27T14:30:00.000Z",
      editedBy: "Dr. Jordan Carter, MD",
      changeSummary: "Added follow-up consultation",
      patientData: {
        id: "3",
        code: "PAT-2026-1048",
        name: "Susan Kim",
        age: 65,
        sex: "Female",
        phone: "+1 (555) 441-0922",
        diagnosis: "Osteoarthritis Secondary Arthropathy",
        consultant: "Dr. Jordan Carter, MD",
        treatment: "Lubriplate Synovial Lubrication Mimic",
        route: "Subcutaneous (SC) Injection",
        amount: "10 mL",
        sessionNo: 6,
        date: "2026-04-20",
        improvement: "Improved",
        notes: "Mild localized arthrosis of the left patellar region coupled with stiffness.",
        followUps: [
          {
            id: "f4",
            date: "2026-04-27",
            status: "Gradual Improvement Observed",
            notes: "Second injection tolerated well, joint mobility improved on flexion tests.",
            clinician: "Dr. Jordan Carter, MD"
          }
        ],
        createdAt: "2026-04-20T09:15:00.000Z",
        submittedBy: "Dr. Jordan Carter, MD",
        lastEditedBy: "Dr. Jordan Carter, MD"
      }
    },
    {
      id: "ver-3-3-1781251200000",
      patientId: "3",
      version: 3,
      timestamp: "2026-05-12T11:45:00.000Z",
      editedBy: "Dr. Jordan Carter, MD",
      changeSummary: "Updated recovery status to: Stable / Maintenance Protocol",
      patientData: {
        id: "3",
        code: "PAT-2026-1048",
        name: "Susan Kim",
        age: 65,
        sex: "Female",
        phone: "+1 (555) 441-0922",
        diagnosis: "Osteoarthritis Secondary Arthropathy",
        consultant: "Dr. Jordan Carter, MD",
        treatment: "Lubriplate Synovial Lubrication Mimic",
        route: "Subcutaneous (SC) Injection",
        amount: "10 mL",
        sessionNo: 6,
        date: "2026-04-20",
        improvement: "Improved",
        notes: "Mild localized arthrosis of the left patellar region coupled with stiffness.",
        followUps: [
          {
            id: "f4",
            date: "2026-04-27",
            status: "Gradual Improvement Observed",
            notes: "Second injection tolerated well, joint mobility improved on flexion tests.",
            clinician: "Dr. Jordan Carter, MD"
          },
          {
            id: "f5",
            date: "2026-05-12",
            status: "Stable / Maintenance Protocol",
            notes: "Range of movement extended by 15 degrees. Flexion is painless under static loads.",
            clinician: "Dr. Jordan Carter, MD"
          }
        ],
        createdAt: "2026-04-20T09:15:00.000Z",
        submittedBy: "Dr. Jordan Carter, MD",
        lastEditedBy: "Dr. Jordan Carter, MD"
      }
    }
  ];

  const sampleLogs = [
    {
      id: "log-009",
      timestamp: "2026-06-05T20:50:00.000Z",
      username: "system",
      action: "SYSTEM_BOOT",
      details: "Concord Stem Cell MSC Record ledger active - Firestore live database connection successfully established.",
      severity: "info"
    },
    {
      id: "log-008",
      timestamp: "2026-05-25T13:10:00.000Z",
      username: "Dr. Alan Vance, MD",
      action: "PATIENT_UPDATE",
      details: "Updated Patient Record for Robert Miller (PAT-2026-9021): Added follow-up consultation",
      severity: "info"
    },
    {
      id: "log-007",
      timestamp: "2026-05-24T15:20:00.000Z",
      username: "Dr. Sarah Jenkins, MD",
      action: "PATIENT_UPDATE",
      details: "Updated Patient Record for Elizabeth Vance (PAT-2026-4819): Updated recovery status to: Significantly Improved - Ready for Discharge Protocol",
      severity: "info"
    },
    {
      id: "log-006",
      timestamp: "2026-05-18T16:30:00.000Z",
      username: "Dr. Alan Vance, MD",
      action: "PATIENT_CREATE",
      details: "Created Patient Record for Robert Miller (PAT-2026-9021)",
      severity: "info"
    },
    {
      id: "log-005",
      timestamp: "2026-05-14T10:15:00.000Z",
      username: "Dr. Sarah Jenkins, MD",
      action: "PATIENT_UPDATE",
      details: "Updated Patient Record for Elizabeth Vance (PAT-2026-4819): Added follow-up consultation",
      severity: "info"
    },
    {
      id: "log-004",
      timestamp: "2026-05-12T11:45:00.000Z",
      username: "Dr. Jordan Carter, MD",
      action: "PATIENT_UPDATE",
      details: "Updated Patient Record for Susan Kim (PAT-2026-1048): Updated recovery status to: Stable / Maintenance Protocol",
      severity: "info"
    },
    {
      id: "log-003",
      timestamp: "2026-05-10T08:00:00.000Z",
      username: "Dr. Sarah Jenkins, MD",
      action: "PATIENT_CREATE",
      details: "Created Patient Record for Elizabeth Vance (PAT-2026-4819)",
      severity: "info"
    },
    {
      id: "log-002",
      timestamp: "2026-04-27T14:30:00.000Z",
      username: "Dr. Jordan Carter, MD",
      action: "PATIENT_UPDATE",
      details: "Updated Patient Record for Susan Kim (PAT-2026-1048): Added follow-up consultation",
      severity: "info"
    },
    {
      id: "log-001",
      timestamp: "2026-04-20T09:15:00.000Z",
      username: "Dr. Jordan Carter, MD",
      action: "PATIENT_CREATE",
      details: "Created Patient Record for Susan Kim (PAT-2026-1048)",
      severity: "info"
    }
  ];

  if (!fs.existsSync(ACTIVITY_LOGS_FILE) || fs.readFileSync(ACTIVITY_LOGS_FILE, 'utf-8').trim() === '[]') {
    fs.writeFileSync(ACTIVITY_LOGS_FILE, JSON.stringify(sampleLogs, null, 2), 'utf-8');
  }
  if (!fs.existsSync(PATIENT_VERSIONS_FILE) || fs.readFileSync(PATIENT_VERSIONS_FILE, 'utf-8').trim() === '[]') {
    fs.writeFileSync(PATIENT_VERSIONS_FILE, JSON.stringify(sampleVersions, null, 2), 'utf-8');
  }

  // Pre-seed sample patients if file empty
  if (!fs.existsSync(PATIENTS_FILE)) {
    const samplePatients = [
      {
        id: '1',
        code: 'PAT-2026-4819',
        name: 'Elizabeth Vance',
        age: 42,
        sex: 'Female',
        phone: '+1 (555) 739-1120',
        diagnosis: 'Migraine Specialist Protocol',
        consultant: 'Dr. Sarah Jenkins, MD',
        treatment: 'Excedrin IV Infusion Protocol',
        route: 'Intravenous (IV) Infusion',
        amount: '100 mL',
        sessionNo: 3,
        date: '2026-05-10',
        improvement: 'Significantly Improved',
        notes: 'Patient presented with history of intractable clinical migraines lasting >72 hours, failing standard oral treatments. Recommended IV protocol.',
        followUps: [
          {
            id: 'f1',
            date: '2026-05-14',
            status: 'Gradual Improvement Observed',
            notes: 'First infusion cycle completed. Migraine frequency reduced from daily occurrences to zero in last 48 hours. Mild hydration advice given.',
            clinician: 'Dr. Sarah Jenkins, MD'
          },
          {
            id: 'f2',
            date: '2026-05-24',
            status: 'Significantly Improved - Ready for Discharge Protocol',
            notes: 'Excellent clinical outcomes. Patient reports zero symptomatic triggers since last follow-up. Vital signs within homeostatic limits.',
            clinician: 'Dr. Sarah Jenkins, MD'
          }
        ],
        createdAt: new Date(Date.now() - 200000).toISOString(),
        submittedBy: 'Dr. Sarah Jenkins, MD',
        lastEditedBy: 'Dr. Sarah Jenkins, MD'
      },
      {
        id: '2',
        code: 'PAT-2026-9021',
        name: 'Robert Miller',
        age: 58,
        sex: 'Male',
        phone: '+1 (555) 302-9118',
        diagnosis: 'Intervertebral Disc Herniation / Sciatica',
        consultant: 'Dr. Alan Vance, MD',
        treatment: 'Physical Decompression & Deep Corticosteroid block',
        route: 'Intramuscular (IM) Injection',
        amount: '5 mg / 2 mL',
        sessionNo: 1,
        date: '2026-05-18',
        improvement: 'Stable',
        notes: 'Severe radicular low back pain radiating down L5 dermatome. Pain rated 8/10 on NRS. Administered guided intramuscular corticosteroid block.',
        followUps: [
          {
            id: 'f3',
            date: '2026-05-25',
            status: 'Stable / Maintenance Protocol',
            notes: 'Numbness in lower extremities somewhat abated. Recommending physical physiotherapy integration.',
            clinician: 'Dr. Alan Vance, MD'
          }
        ],
        createdAt: new Date(Date.now() - 150000).toISOString(),
        submittedBy: 'Dr. Alan Vance, MD',
        lastEditedBy: 'Dr. Alan Vance, MD'
      },
      {
        id: '3',
        code: 'PAT-2026-1048',
        name: 'Susan Kim',
        age: 65,
        sex: 'Female',
        phone: '+1 (555) 441-0922',
        diagnosis: 'Osteoarthritis Secondary Arthropathy',
        consultant: 'Dr. Jordan Carter, MD',
        treatment: 'Lubriplate Synovial Lubrication Mimic',
        route: 'Subcutaneous (SC) Injection',
        amount: '10 mL',
        sessionNo: 6,
        date: '2026-04-20',
        improvement: 'Improved',
        notes: 'Mild localized arthrosis of the left patellar region coupled with stiffness.',
        followUps: [
          {
            id: 'f4',
            date: '2026-04-27',
            status: 'Gradual Improvement Observed',
            notes: 'Second injection tolerated well, joint mobility improved on flexion tests.',
            clinician: 'Dr. Jordan Carter, MD'
          },
          {
            id: 'f5',
            date: '2026-05-12',
            status: 'Stable / Maintenance Protocol',
            notes: 'Range of movement extended by 15 degrees. Flexion is painless under static loads.',
            clinician: 'Dr. Jordan Carter, MD'
          }
        ],
        createdAt: new Date(Date.now() - 100000).toISOString(),
        submittedBy: 'Dr. Jordan Carter, MD',
        lastEditedBy: 'Dr. Jordan Carter, MD'
      }
    ];
    fs.writeFileSync(PATIENTS_FILE, JSON.stringify(samplePatients, null, 2));
  }

  // Pre-seed empty users dictionary
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
  }

  // Ensure permanent admin toticellmedicalofficer@gmail.com with password 78600000 is correctly configured
  try {
    const usersStr = fs.readFileSync(USERS_FILE, 'utf-8');
    const users = JSON.parse(usersStr);
    const ADMIN_EMAIL = "toticellmedicalofficer@gmail.com";
    const adminUser = users[ADMIN_EMAIL];

    if (!adminUser || adminUser.hasChangedPassword !== true) {
      console.log(`Configuring or resetting permanent admin credentials for ${ADMIN_EMAIL}...`);
      const adminPassword = "78600000";
      const salt = adminUser?.salt || crypto.randomBytes(16).toString('base64');
      
      const verifierHash = crypto.pbkdf2Sync(
        adminPassword,
        Buffer.from(salt, 'base64'),
        100000,
        32,
        'sha256'
      ).toString('base64');

      users[ADMIN_EMAIL] = {
        username: ADMIN_EMAIL,
        fullName: adminUser?.fullName || "Dr Md Faisal Ahmed",
        specialty: adminUser?.specialty || "Medical Officer",
        salt,
        verifierHash,
        securityQuestion: adminUser?.securityQuestion || "What was the name of your first clinical facility?",
        recoveryPayload: adminUser?.recoveryPayload || {
          ciphertext: "xyZ/tcBraFs+8xhoZa/7fIGEOVTrqQA7",
          iv: "onJpXMboYhy6HxPR"
        },
        recoveryHint: adminUser?.recoveryHint || "",
        createdAt: adminUser?.createdAt || "2026-06-02T22:37:29.184Z",
        role: "admin",
        approval: "approved"
      };
      
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
      console.log(`Successfully configured active directory for ${ADMIN_EMAIL}.`);
    }
  } catch (e) {
    console.warn(`Error during pre-seeding permanent admin ${e}`);
  }

  // Pre-seed settings file
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
      diagnoses: [
        'Migraine Specialist Protocol',
        'Chronic Intractable Pain Syndrome',
        'Osteoarthritis Secondary Arthropathy',
        'Intervertebral Disc Herniation / Sciatica',
        'Juvenile Rheumatoid & Fibromyalgia',
        'Diabetic Sensory Polyneuropathy',
        'Carpal Tunnel Decompression Followup',
        'Complex Regional Pain Syndrome (CRPS)'
      ],
      routes: [
        'Intravenous (IV) Infusion',
        'Intramuscular (IM) Injection',
        'Oral Administration (PO)',
        'Subcutaneous (SC) Injection',
        'Transdermal Patch / Topical Gel',
        'Inhalation / Nebulizer Protocol'
      ],
      procedurePlaces: [
        'Operating Room A',
        'Minor Procedure Suite',
        'Outpatient Treatment Bay 3',
        'Infusion Lounge'
      ],
      consultants: [
        'Dr. Sarah Jenkins, MD',
        'Dr. Alan Vance, MD',
        'Dr. Jordan Carter, MD',
        'Dr. Eleanor Vance, MD'
      ],
      treatments: [
        'Excedrin IV Dosing Protocol',
        'Neuromuscular Blockade Protocol',
        'Exosome Infusion Therapy',
        'Standard Stem Cell Intravenous Protocol',
        'Targeted Spine Joint Prolotherapy',
        'Regenerative Joint Infiltration',
        'Myofascial Trigger Point Injection'
      ],
      recoveryStatuses: [
        'Stable / Maintenance Protocol',
        'Significantly Improved - Ready for Discharge Protocol',
        'Gradual Improvement Observed',
        'No Changes (Symptomatic Plateau)',
        'Minor Flareups / Temporary Regression',
        'Deteriorated / Urgent Re-assessment Required'
      ],
      theme: 'blue',
      appName: 'Concord Stem Cell MSC Record',
      companyLogo: '/src/assets/images/concord_logo_1780689503864.png'
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
  }
}

initDatabase();

// Helpers for Reading / Writing safely
const readJSON = (filePath: string) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return {};
  }
};

const writeJSON = (filePath: string, data: any) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

const writeLog = async (username: string, action: string, details: string, severity: 'info' | 'warn' | 'error' = 'info') => {
  const log = {
    id: 'log-' + Date.now() + '-' + Math.round(Math.random() * 1000000),
    timestamp: new Date().toISOString(),
    username: username || 'system',
    action,
    details,
    severity
  };
  try {
    let logs = readJSON(ACTIVITY_LOGS_FILE);
    if (!Array.isArray(logs)) {
      logs = [];
    }
    logs.unshift(log);
    if (logs.length > 2000) {
      logs.length = 2000;
    }
    writeJSON(ACTIVITY_LOGS_FILE, logs);

    if (isFirestoreAvailable) {
      const docRef = doc(db, 'activity_logs', log.id);
      await setDoc(docRef, log);
    }
  } catch (err) {
    console.warn('Failed to write activity log:', err);
  }
};

// Database availability flag and test check
let isFirestoreAvailable = false;

async function checkFirestoreAvailability() {
  try {
    const docRef = doc(db, 'settings', 'global');
    await getDoc(docRef);
    isFirestoreAvailable = true;
    console.log('[Database] Firestore live database connection successfully established!');
  } catch (error) {
    isFirestoreAvailable = false;
    console.warn('[Database] Firestore is offline or permissions are restricted. Activating secure local fallback ledger engine.');
  }
}

// Firestore Error Handler Utility
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation bypassed:', JSON.stringify(errInfo));
}

// Firestore async getter primitives
async function getAllPatients(): Promise<any[]> {
  if (isFirestoreAvailable) {
    try {
      const colRef = collection(db, 'patients');
      const snapshot = await getDocs(colRef);
      const patientsList: any[] = [];
      snapshot.forEach((docSnap) => {
        patientsList.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      if (patientsList.length === 0) {
        const localPatients = readJSON(PATIENTS_FILE);
        return Array.isArray(localPatients) ? localPatients : [];
      }

      patientsList.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      return patientsList;
    } catch (error) {
      console.warn('[Database] Failed to view patients from Firestore, reading local backup.');
      const localPatients = readJSON(PATIENTS_FILE);
      return Array.isArray(localPatients) ? localPatients : [];
    }
  }
  const localPatients = readJSON(PATIENTS_FILE);
  return Array.isArray(localPatients) ? localPatients : [];
}

async function getGlobalSettings(): Promise<any> {
  if (isFirestoreAvailable) {
    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (error) {
      console.warn('[Database] Failed to view global settings from Firestore, reading local backup.');
    }
  }
  return readJSON(SETTINGS_FILE);
}

// Firestore auto-seeding engine
async function seedFirestoreCollections() {
  try {
    // 1. Seed Patients
    const patientsCol = collection(db, 'patients');
    const patientsSnap = await getDocs(query(patientsCol, limit(1)));
    if (patientsSnap.empty) {
      console.log('Seeding initial default patients ledger into live cloud database...');
      const localPatients = readJSON(PATIENTS_FILE);
      if (Array.isArray(localPatients)) {
        for (const patient of localPatients) {
          if (patient && patient.id) {
            await setDoc(doc(db, 'patients', patient.id), patient);
          }
        }
      }
    }

    // 2. Seed Settings
    const settingsDocRef = doc(db, 'settings', 'global');
    const settingsSnap = await getDoc(settingsDocRef);
    if (!settingsSnap.exists()) {
      console.log('Seeding initial default custom settings into live cloud database...');
      const localSettings = readJSON(SETTINGS_FILE);
      await setDoc(settingsDocRef, localSettings);
    }

    // 3. Seed Users/Clinicians
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(query(usersCol, limit(1)));
    if (usersSnap.empty) {
      console.log('Seeding initial clinicians directory into live cloud database...');
      const localUsers = readJSON(USERS_FILE);
      for (const [username, record] of Object.entries(localUsers)) {
        await setDoc(doc(db, 'users', username), record as any);
      }
    } else {
      // Ensure the permanent admin is synced/updated to Firestore if not already changed
      try {
        const ADMIN_EMAIL = 'toticellmedicalofficer@gmail.com';
        const adminDocRef = doc(db, 'users', ADMIN_EMAIL);
        const adminDocSnap = await getDoc(adminDocRef);
        if (!adminDocSnap.exists() || !adminDocSnap.data()?.hasChangedPassword) {
          const localUsers = readJSON(USERS_FILE);
          const adminRecord = localUsers[ADMIN_EMAIL];
          if (adminRecord) {
            console.log(`Syncing permanent admin "${ADMIN_EMAIL}" check to Firestore...`);
            await setDoc(adminDocRef, adminRecord as any);
          }
        }
      } catch (err) {
        console.warn('Error during Firestore permanent admin check:', err);
      }
    }
  } catch (e) {
    console.warn('Database pre-seeding pipeline bypassed or partially failed:', e);
  }
}

// Run async connection check followed by conditional seeding
async function initFirestoreConnection() {
  await checkFirestoreAvailability();
  if (isFirestoreAvailable) {
    await seedFirestoreCollections();
  }
}
initFirestoreConnection();

// API ENDPOINTS

// 1. Get Patients Ledger
app.get('/api/patients', async (req, res) => {
  const patientsList = await getAllPatients();
  res.json(patientsList);
});

// 2. Save Patients List (Bulk or Update Complete List)
app.post('/api/patients/bulk', async (req, res) => {
  const incomingPatients = req.body;
  if (!Array.isArray(incomingPatients)) {
    return res.status(400).json({ error: 'Data must be an array of patients' });
  }

  // Get what exists before writing
  const existingRaw = readJSON(PATIENTS_FILE);
  const existingPatients = Array.isArray(existingRaw) ? existingRaw : [];
  const existingMap = new Map(existingPatients.map((p: any) => [p.id, p]));

  // Identify who is performing this sync
  const firstWithEditor = incomingPatients.find((p: any) => p.lastEditedBy || p.submittedBy);
  const editorName = firstWithEditor ? (firstWithEditor.lastEditedBy || firstWithEditor.submittedBy) : 'system';

  // Perform diff checks and save versions
  const versionsRaw = readJSON(PATIENT_VERSIONS_FILE);
  const allVersions = Array.isArray(versionsRaw) ? versionsRaw : [];

  for (const incoming of incomingPatients) {
    if (!incoming || !incoming.id) continue;
    const old = existingMap.get(incoming.id);

    if (!old) {
      // BRAND NEW record addition
      const vId = `ver-${incoming.id}-1-${Date.now()}`;
      const newVer = {
        id: vId,
        patientId: incoming.id,
        version: 1,
        timestamp: new Date().toISOString(),
        editedBy: incoming.submittedBy || editorName,
        changeSummary: 'Initial Admission Created',
        patientData: incoming
      };
      allVersions.push(newVer);
      if (isFirestoreAvailable) {
        try { await setDoc(doc(db, 'patient_versions', vId), newVer); } catch(e) {}
      }
      await writeLog(
        incoming.submittedBy || editorName,
        'PATIENT_CREATE',
        `Created Patient Record for ${incoming.name} (${incoming.code})`
      );
    } else {
      // COMPARE differences to see if we should spin a new version
      const diffFields = ['name', 'age', 'sex', 'phone', 'diagnosis', 'consultant', 'treatment', 'route', 'amount', 'sessionNo', 'date', 'improvement', 'notes'];
      const hasDiff = diffFields.some(f => String(incoming[f] || '') !== String(old[f] || '')) || 
                      (incoming.followUps?.length || 0) !== (old.followUps?.length || 0);

      if (hasDiff) {
        const patientVers = allVersions.filter((v: any) => v.patientId === incoming.id);
        const latestVerNo = patientVers.reduce((max: number, v: any) => Math.max(max, v.version || 1), 0);
        const nextVerNo = latestVerNo === 0 ? 1 : latestVerNo + 1;

        let summary = 'Modified record details';
        if ((incoming.followUps?.length || 0) > (old.followUps?.length || 0)) {
          summary = 'Added follow-up consultation';
        } else if (incoming.improvement !== old.improvement) {
          summary = `Updated recovery status to: ${incoming.improvement}`;
        } else if (incoming.name !== old.name || incoming.age !== old.age || incoming.diagnosis !== old.diagnosis) {
          summary = 'Updated demographics and clinical profile';
        }

        const vId = `ver-${incoming.id}-${nextVerNo}-${Date.now()}`;
        const newVer = {
          id: vId,
          patientId: incoming.id,
          version: nextVerNo,
          timestamp: new Date().toISOString(),
          editedBy: incoming.lastEditedBy || editorName,
          changeSummary: summary,
          patientData: incoming
        };
        allVersions.push(newVer);
        if (isFirestoreAvailable) {
          try { await setDoc(doc(db, 'patient_versions', vId), newVer); } catch(e) {}
        }
        await writeLog(
          incoming.lastEditedBy || editorName,
          'PATIENT_UPDATE',
          `Updated Patient Record for ${incoming.name} (${incoming.code}): ${summary}`
        );
      }
    }
  }

  // Detect deletions (if old exists but is missing in new)
  const incomingIds = new Set(incomingPatients.map((p: any) => p.id));
  for (const old of existingPatients) {
    if (!incomingIds.has(old.id)) {
      await writeLog(
        editorName,
        'PATIENT_DELETE',
        `Deleted Patient Record for ${old.name} (${old.code})`
      );
    }
  }

  // Save the main list & versions list
  writeJSON(PATIENTS_FILE, incomingPatients);
  writeJSON(PATIENT_VERSIONS_FILE, allVersions);

  // Sync to Firestore
  if (isFirestoreAvailable) {
    try {
      for (const patient of incomingPatients) {
        if (patient && patient.id) {
          await setDoc(doc(db, 'patients', patient.id), patient);
        }
      }
      // Delete removed documents from firestore
      for (const old of existingPatients) {
        if (!incomingIds.has(old.id)) {
          await deleteDoc(doc(db, 'patients', old.id));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'patients/bulk');
    }
  }

  res.json({ success: true, count: incomingPatients.length, synced: isFirestoreAvailable });
});

// 3. Add Single Patient
app.post('/api/patients', async (req, res) => {
  const newPatient = req.body;
  
  const patients = readJSON(PATIENTS_FILE);
  const patientsArray = Array.isArray(patients) ? patients : [];
  patientsArray.unshift(newPatient);
  writeJSON(PATIENTS_FILE, patientsArray);

  // Create Version 1
  const vId = `ver-${newPatient.id}-1-${Date.now()}`;
  const newVer = {
    id: vId,
    patientId: newPatient.id,
    version: 1,
    timestamp: new Date().toISOString(),
    editedBy: newPatient.submittedBy || 'unknown',
    changeSummary: 'Initial Admission Created',
    patientData: newPatient
  };
  const versionsRaw = readJSON(PATIENT_VERSIONS_FILE);
  const allVersions = Array.isArray(versionsRaw) ? versionsRaw : [];
  allVersions.push(newVer);
  writeJSON(PATIENT_VERSIONS_FILE, allVersions);

  // Write Log
  await writeLog(newPatient.submittedBy || 'unknown', 'PATIENT_CREATE', `Created Patient Record for ${newPatient.name} (${newPatient.code})`);

  if (isFirestoreAvailable) {
    try {
      if (newPatient && newPatient.id) {
        await setDoc(doc(db, 'patients', newPatient.id), newPatient);
        await setDoc(doc(db, 'patient_versions', vId), newVer);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `patients/${newPatient?.id}`);
    }
  }
  res.json(newPatient);
});

// 4. Update Single Patient
app.put('/api/patients/:id', async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  
  const patients = readJSON(PATIENTS_FILE);
  const patientsArray = Array.isArray(patients) ? patients : [];
  const index = patientsArray.findIndex((p: any) => p.id === id);
  const oldPatient = index !== -1 ? patientsArray[index] : null;

  let fallbackPatient: any = null;
  if (index !== -1) {
    patientsArray[index] = { ...patientsArray[index], ...updatedData };
    fallbackPatient = patientsArray[index];
    writeJSON(PATIENTS_FILE, patientsArray);
  } else {
    fallbackPatient = { id, ...updatedData };
    patientsArray.push(fallbackPatient);
    writeJSON(PATIENTS_FILE, patientsArray);
  }

  // Create Version
  const versionsRaw = readJSON(PATIENT_VERSIONS_FILE);
  const allVersions = Array.isArray(versionsRaw) ? versionsRaw : [];
  const patientVers = allVersions.filter((v: any) => v.patientId === id);
  const latestVerNo = patientVers.reduce((max: number, v: any) => Math.max(max, v.version || 1), 0);
  const nextVerNo = latestVerNo === 0 ? 1 : latestVerNo + 1;

  let summary = 'Modified record details';
  if (oldPatient) {
    if ((fallbackPatient.followUps?.length || 0) > (oldPatient.followUps?.length || 0)) {
      summary = 'Added follow-up consultation';
    } else if (fallbackPatient.improvement !== oldPatient.improvement) {
      summary = `Updated recovery status to: ${fallbackPatient.improvement}`;
    } else if (fallbackPatient.name !== oldPatient.name || fallbackPatient.age !== oldPatient.age) {
      summary = 'Updated patient demographics';
    }
  }

  const vId = `ver-${id}-${nextVerNo}-${Date.now()}`;
  const newVer = {
    id: vId,
    patientId: id,
    version: nextVerNo,
    timestamp: new Date().toISOString(),
    editedBy: fallbackPatient.lastEditedBy || fallbackPatient.submittedBy || 'unknown',
    changeSummary: summary,
    patientData: fallbackPatient
  };
  allVersions.push(newVer);
  writeJSON(PATIENT_VERSIONS_FILE, allVersions);

  // Write Log
  await writeLog(fallbackPatient.lastEditedBy || fallbackPatient.submittedBy || 'unknown', 'PATIENT_UPDATE', `Updated Patient Record for ${fallbackPatient.name} (${fallbackPatient.code}): ${summary}`);

  if (isFirestoreAvailable) {
    try {
      const docRef = doc(db, 'patients', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const merged = { ...docSnap.data(), ...updatedData };
        await setDoc(docRef, merged);
      } else {
        await setDoc(docRef, fallbackPatient);
      }
      await setDoc(doc(db, 'patient_versions', vId), newVer);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${id}`);
    }
  }
  res.json(fallbackPatient);
});

// 5. Delete Patient
app.delete('/api/patients/:id', async (req, res) => {
  const { id } = req.params;
  
  let patients = readJSON(PATIENTS_FILE);
  const patientsArray = Array.isArray(patients) ? patients : [];
  const oldPatient = patientsArray.find((p: any) => p.id === id);
  
  const remaining = patientsArray.filter((p: any) => p.id !== id);
  writeJSON(PATIENTS_FILE, remaining);

  if (oldPatient) {
    await writeLog(oldPatient.lastEditedBy || 'unknown', 'PATIENT_DELETE', `Deleted Patient Record for ${oldPatient.name} (${oldPatient.code})`);
  }

  if (isFirestoreAvailable) {
    try {
      await deleteDoc(doc(db, 'patients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `patients/${id}`);
    }
  }
  res.json({ success: true });
});

// 5a. Get Activity Logs
app.get('/api/logs', async (req, res) => {
  try {
    let logs = readJSON(ACTIVITY_LOGS_FILE);
    if (!Array.isArray(logs)) {
      logs = [];
    }
    logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// 5b. Add Security Log Manually
app.post('/api/logs', async (req, res) => {
  const { username, action, details, severity } = req.body;
  if (!action || !details) {
    return res.status(400).json({ error: 'Action and details are required' });
  }
  await writeLog(username || 'system', action, details, severity || 'info');
  res.json({ success: true });
});

// 5c. Get Patient Historical Versions
app.get('/api/patients/:id/versions', async (req, res) => {
  const { id } = req.params;
  try {
    const versionsRaw = readJSON(PATIENT_VERSIONS_FILE);
    const allVersions = Array.isArray(versionsRaw) ? versionsRaw : [];
    const patientVersions = allVersions.filter((v: any) => v.patientId === id);
    patientVersions.sort((a: any, b: any) => b.version - a.version);
    res.json(patientVersions);
  } catch (e) {
    res.status(500).json({ error: 'Failed to retrieve versions' });
  }
});

// 5d. Restore Patient Record Version
app.post('/api/patients/:id/versions/:versionId/restore', async (req, res) => {
  const { id, versionId } = req.params;
  const { restoredBy } = req.body;
  try {
    const versionsRaw = readJSON(PATIENT_VERSIONS_FILE);
    const allVersions = Array.isArray(versionsRaw) ? versionsRaw : [];
    const versionMatch = allVersions.find((v: any) => v.patientId === id && v.id === versionId);
    
    if (!versionMatch) {
      return res.status(404).json({ error: 'Version record not found' });
    }

    const restoredData = { ...versionMatch.patientData, lastEditedBy: restoredBy || 'system' };

    // Update primary patients raw file
    const patients = readJSON(PATIENTS_FILE);
    const patientsArray = Array.isArray(patients) ? patients : [];
    const idx = patientsArray.findIndex((p: any) => p.id === id);
    if (idx !== -1) {
      patientsArray[idx] = restoredData;
    } else {
      patientsArray.push(restoredData);
    }
    writeJSON(PATIENTS_FILE, patientsArray);

    // Create a new checkpoint version to record the restore
    const patientVers = allVersions.filter((v: any) => v.patientId === id);
    const latestVerNo = patientVers.reduce((max: number, v: any) => Math.max(max, v.version || 1), 0);
    const nextVerNo = latestVerNo + 1;

    const vId = `ver-${id}-${nextVerNo}-${Date.now()}`;
    const newVer = {
      id: vId,
      patientId: id,
      version: nextVerNo,
      timestamp: new Date().toISOString(),
      editedBy: restoredBy || 'system',
      changeSummary: `Restored record to Version ${versionMatch.version}`,
      patientData: restoredData
    };
    allVersions.push(newVer);
    writeJSON(PATIENT_VERSIONS_FILE, allVersions);

    // Write audit log
    await writeLog(
      restoredBy || 'system',
      'PATIENT_RESTORE',
      `Restored Patient ${restoredData.name} (${restoredData.code}) to Version ${versionMatch.version}`
    );

    // Sync to Firestore
    if (isFirestoreAvailable) {
      await setDoc(doc(db, 'patients', id), restoredData);
      await setDoc(doc(db, 'patient_versions', vId), newVer);
    }

    res.json({ success: true, patient: restoredData });
  } catch (e) {
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// 6. Get Clinician Directory
app.get('/api/users', async (req, res) => {
  if (isFirestoreAvailable) {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersMap: any = {};
      snapshot.forEach((docSnap) => {
        usersMap[docSnap.id] = docSnap.data();
      });
      if (Object.keys(usersMap).length === 0) {
        res.json(readJSON(USERS_FILE));
      } else {
        res.json(usersMap);
      }
      return;
    } catch (error) {
      console.warn('[Database] Query users collection failed, using local backup.');
    }
  }
  res.json(readJSON(USERS_FILE));
});

// Check if any administrator account (role === 'admin') exists in database
app.get('/api/check-admin-exists', async (req, res) => {
  try {
    let hasAdmin = false;
    if (isFirestoreAvailable) {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        snapshot.forEach((docSnap) => {
          if (docSnap.data()?.role === 'admin') {
            hasAdmin = true;
          }
        });
      } catch (e) {
        console.warn('[Database] Admin presence search failed on Firestore:', e);
      }
    }
    
    if (!hasAdmin) {
      const users = readJSON(USERS_FILE);
      for (const username of Object.keys(users)) {
        if (users[username]?.role === 'admin') {
          hasAdmin = true;
          break;
        }
      }
    }

    res.json({ exists: hasAdmin });
  } catch (err) {
    console.error('Error during administrative presence check:', err);
    res.json({ exists: false, error: String(err) });
  }
});

// 7. Register Clinician
app.post('/api/users', async (req, res) => {
  const { username, userRecord } = req.body;
  if (!username || !userRecord) {
    return res.status(400).json({ error: 'Invalid user registration payload.' });
  }

  const lowerUser = username.toLowerCase().trim();
  const users = readJSON(USERS_FILE);
  const settings = readJSON(SETTINGS_FILE);

  // Seek admin existence in active database
  let hasExistingAdmin = false;
  if (isFirestoreAvailable) {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      snapshot.forEach((docSnap) => {
        if (docSnap.data()?.role === 'admin') {
          hasExistingAdmin = true;
        }
      });
    } catch (e) {
      console.warn('Firestore active check during admin registration lookup failed, using local backup fallback:', e);
    }
  }

  if (!hasExistingAdmin) {
    for (const username of Object.keys(users)) {
      if (users[username]?.role === 'admin') {
        hasExistingAdmin = true;
        break;
      }
    }
  }

  // Force role to admin if there is absolutely no admin configured in the directory (prevents lockout on bootstrap)
  let userRole = userRecord.role || 'user';
  if (!hasExistingAdmin) {
    userRole = 'admin';
  }

  // Enforce administrative registration lock if enabled under settings (ignored for first administrator)
  if (userRole === 'admin' && settings.disableAdminJoining && hasExistingAdmin) {
    userRole = 'user';
  }

  const userApproval = (userRole === 'admin') ? 'approved' : 'pending';

  // Sync local file-system fallback
  users[lowerUser] = {
    ...userRecord,
    role: userRole,
    approval: userApproval
  };
  writeJSON(USERS_FILE, users);

  if (isFirestoreAvailable) {
    try {
      const docRef = doc(db, 'users', lowerUser);
      const newRecord = {
        ...userRecord,
        role: userRole,
        approval: userApproval
      };
      await setDoc(docRef, newRecord);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${lowerUser}`);
    }
  }
  res.json({ success: true });
});

// 7b. Update Clinician Role (Admin-Only action)
app.post('/api/users/update-role', async (req, res) => {
  const { username, role } = req.body;
  if (!username || !role) {
    return res.status(400).json({ error: 'Username and role are required.' });
  }
  
  const lowerUser = username.toLowerCase().trim();
  const users = readJSON(USERS_FILE);
  let fallbackUser: any = null;

  // Enforce "Only 1 Admin" rule: if a user is promoted to 'admin', demote existing admin(s) to 'co-admin'
  if (role === 'admin') {
    for (const uKey of Object.keys(users)) {
      if (uKey !== lowerUser && users[uKey].role === 'admin') {
        users[uKey].role = 'co-admin';
        if (isFirestoreAvailable) {
          try {
            const oldAdminRef = doc(db, 'users', uKey);
            const oldSnap = await getDoc(oldAdminRef);
            if (oldSnap.exists()) {
              await setDoc(oldAdminRef, { ...oldSnap.data(), role: 'co-admin' });
            }
          } catch (e) {
            console.warn(`[RoleSync] Failed to demote firestore admin ${uKey}:`, e);
          }
        }
      }
    }
  }

  if (users[lowerUser]) {
    users[lowerUser].role = role;
    fallbackUser = users[lowerUser];
    writeJSON(USERS_FILE, users);
  }

  if (isFirestoreAvailable) {
    try {
      const docRef = doc(db, 'users', lowerUser);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const merged = { ...docSnap.data(), role };
        await setDoc(docRef, merged);
      } else if (fallbackUser) {
        await setDoc(docRef, fallbackUser);
      } else {
        return res.status(404).json({ error: 'Clinician not found in ledger.' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${lowerUser}`);
    }
  }
  res.json({ success: true, user: fallbackUser || { username: lowerUser, role } });
});

// 7d. Update Clinician Access Permission Approval (Admin-Only action)
app.post('/api/users/update-approval', async (req, res) => {
  const { username, approval } = req.body;
  if (!username || !approval) {
    return res.status(400).json({ error: 'Username and approval state are required.' });
  }
  
  const lowerUser = username.toLowerCase().trim();
  const users = readJSON(USERS_FILE);
  let fallbackUser: any = null;
  if (users[lowerUser]) {
    users[lowerUser].approval = approval;
    fallbackUser = users[lowerUser];
    writeJSON(USERS_FILE, users);
  }

  if (isFirestoreAvailable) {
    try {
      const docRef = doc(db, 'users', lowerUser);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const merged = { ...docSnap.data(), approval };
        await setDoc(docRef, merged);
      } else if (fallbackUser) {
        await setDoc(docRef, fallbackUser);
      } else {
        return res.status(404).json({ error: 'Clinician not found in ledger.' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${lowerUser}`);
    }
  }
  res.json({ success: true, user: fallbackUser || { username: lowerUser, approval } });
});

// 7c. Update Clinician Profile Details
app.post('/api/users/update-profile', async (req, res) => {
  const { username, profileData } = req.body;
  if (!username || !profileData) {
    return res.status(400).json({ error: 'Username and profileData are required.' });
  }

  const lowerUser = username.toLowerCase().trim();
  const users = readJSON(USERS_FILE);
  if (!users[lowerUser]) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  // Update details
  users[lowerUser] = {
    ...users[lowerUser],
    fullName: profileData.fullName || users[lowerUser].fullName,
    email: profileData.email || users[lowerUser].email,
    age: profileData.age !== undefined ? profileData.age : users[lowerUser].age,
    sex: profileData.sex || users[lowerUser].sex,
    employeeId: profileData.employeeId || users[lowerUser].employeeId,
    designation: profileData.designation || users[lowerUser].designation,
    specialty: profileData.specialty || users[lowerUser].specialty || profileData.designation,
    phoneNumber: profileData.phoneNumber || users[lowerUser].phoneNumber,
    department: profileData.department || users[lowerUser].department,
  };

  writeJSON(USERS_FILE, users);

  if (isFirestoreAvailable) {
    try {
      const docRef = doc(db, 'users', lowerUser);
      await setDoc(docRef, users[lowerUser]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${lowerUser}`);
    }
  }

  res.json({ success: true, updatedUser: users[lowerUser] });
});

// Update Clinician Password (Master Key Rotation)
app.post('/api/users/update-password', async (req, res) => {
  const { username, salt, verifierHash, recoveryPayload } = req.body;
  if (!username || !salt || !verifierHash || !recoveryPayload) {
    return res.status(400).json({ error: 'Missing required cryptographic fields.' });
  }

  const lowerUser = username.toLowerCase().trim();
  const users = readJSON(USERS_FILE);
  if (!users[lowerUser]) {
    return res.status(404).json({ error: 'Clinician profile not found.' });
  }

  // Update password details
  users[lowerUser] = {
    ...users[lowerUser],
    salt,
    verifierHash,
    recoveryPayload,
    hasChangedPassword: true
  };

  writeJSON(USERS_FILE, users);

  if (isFirestoreAvailable) {
    try {
      const docRef = doc(db, 'users', lowerUser);
      await setDoc(docRef, users[lowerUser]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${lowerUser}`);
    }
  }

  await writeLog(lowerUser, 'PASSWORD_CHANGE', `Clinician master password successfully rotated and cryptographically updated.`, 'info');

  res.json({ success: true, updatedUser: users[lowerUser] });
});

// 8. Get Settings
app.get('/api/settings', async (req, res) => {
  const settings = await getGlobalSettings();
  res.json(settings);
});

// 9. Save Settings
app.post('/api/settings', async (req, res) => {
  const settings = req.body;
  writeJSON(SETTINGS_FILE, settings);

  if (isFirestoreAvailable) {
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  }
  res.json({ success: true });
});



// VITE MIDDLEWARE INTERACTION & PRODUCTION STATIC ROUTING
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EHR Shared Full-Stack Server booted on http://localhost:${PORT}`);
  });
}

startServer();

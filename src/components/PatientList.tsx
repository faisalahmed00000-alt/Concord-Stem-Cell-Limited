import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ShieldAlert, 
  Phone, 
  PhoneCall, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  CalendarCheck2, 
  Clock, 
  PlusCircle, 
  Trash2, 
  HeartPulse, 
  User, 
  X, 
  Send, 
  ArrowUpDown,
  Copy, 
  Check, 
  Share2, 
  FileSpreadsheet, 
  FileDown, 
  Upload, 
  CheckSquare, 
  Mail,
  Printer,
  Paperclip, 
  Download,
  Cloud,
  ExternalLink,
  RefreshCw,
  Lock,
  LogOut,
  Sparkles,
  FileEdit,
  Activity,
  Eye,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Layers,
  Shuffle,
  Database,
  Compass,
  History,
  RotateCcw
} from 'lucide-react';
import { Patient, FollowUp, PatientAttachment, TreatmentSession } from '../types/patient';
import { secureStorage } from '../utils/storage';
import { FormSettings, ThemeOption } from '../types/settings';
import * as XLSX from 'xlsx';
import PrintProfileModal from './PrintProfileModal';
import { 
  initAuth, 
  googleSignIn, 
  logout as googleLogout, 
  getAccessToken, 
  setManualAccessToken 
} from '../utils/firebase';
import { 
  createSpreadsheet, 
  updateSpreadsheetValues, 
  getSpreadsheetValues, 
  mapPatientsToSheetRows, 
  mapSheetRowsToPatients,
  listSpreadsheetsInDrive,
  SpreadsheetMetadata,
  exportPatientOutcomesReport
} from '../utils/googleSheets';
import { 
  exportPatientProgressDoc 
} from '../utils/googleDocs';
import { 
  backupDatabaseToDrive, 
  listBackupsInDrive, 
  restoreDatabaseFromDrive 
} from '../utils/googleDrive';
import { User as FirebaseUser } from 'firebase/auth';


function formatDateToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch (e) {}
  return dateStr;
}

function getTextPreview(file: PatientAttachment): string | null {
  if (!file || !file.data) return null;
  const mime = file.type?.toLowerCase() || '';
  const name = file.name?.toLowerCase() || '';
  if (
    mime.startsWith('text/') || 
    name.endsWith('.txt') || 
    name.endsWith('.md') || 
    name.endsWith('.log') ||
    name.endsWith('.xml') ||
    name.endsWith('.csv') ||
    name.endsWith('.json')
  ) {
    try {
      const parts = file.data.split(',');
      const base64Data = parts[1] || parts[0];
      if (base64Data) {
        // Decode base64 bytes accurately (handles unicode/utf-8 nicely)
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
      }
    } catch (e) {
      try {
        // Fallback simple atob
        const parts = file.data.split(',');
        return atob(parts[1] || parts[0]);
      } catch (err) {
        console.error('Error decoding file preview', err);
      }
    }
  }
  return null;
}


interface PatientListProps {
  patients: Patient[];
  onAddFollowUpClick: (patientId: string) => void;
  onDeletePatient: (patientId: string) => void;
  onImportPatients: (importedList: Patient[]) => Promise<void>;
  onUpdatePatient: (updatedPatient: Patient) => void;
  settings: FormSettings;
  activeTheme: ThemeOption;
  onUpdateSettings?: (newSettings: FormSettings) => void;
  userRole?: 'admin' | 'co-admin' | 'user';
  dbUsers?: Record<string, any>;
}

export default function PatientList({ 
  patients, 
  onAddFollowUpClick, 
  onDeletePatient, 
  onImportPatients,
  onUpdatePatient,
  settings,
  activeTheme,
  onUpdateSettings,
  userRole,
  dbUsers = {}
}: PatientListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiagnosis, setFilterDiagnosis] = useState<string>('All');
  const [filterImprovement, setFilterImprovement] = useState<string>('All');
  const [filterConsultant, setFilterConsultant] = useState<string>('All');
  const [filterRoute, setFilterRoute] = useState<string>('All');
  const [searchExpanded, setSearchExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    if (window.innerWidth < 1024) {
      setSearchExpanded(false);
    } else {
      setSearchExpanded(true);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  const [patientTabs, setPatientTabs] = useState<Record<string, 'followups' | 'sessions' | 'attachments' | 'versions'>>({});
  const [versions, setVersions] = useState<Record<string, any[]>>({});
  const [versionsLoading, setVersionsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (expandedPatientId) {
      setVersionsLoading(prev => ({ ...prev, [expandedPatientId]: true }));
      fetch(`/api/patients/${expandedPatientId}/versions`)
        .then(res => res.json())
        .then(data => {
          setVersions(prev => ({ ...prev, [expandedPatientId]: Array.isArray(data) ? data : [] }));
          setVersionsLoading(prev => ({ ...prev, [expandedPatientId]: false }));
        })
        .catch(err => {
          console.error('Failed to view snapshots:', err);
          setVersionsLoading(prev => ({ ...prev, [expandedPatientId]: false }));
        });
    }
  }, [expandedPatientId]);

  const [showAddSessionId, setShowAddSessionId] = useState<string | null>(null);

  // Add treatment session states
  const [sessionNo, setSessionNo] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState<string>('');
  const [sessionConsultant, setSessionConsultant] = useState<string>('');
  const [sessionConsultantCustom, setSessionConsultantCustom] = useState<string>('');
  const [sessionTreatment, setSessionTreatment] = useState<string>('');
  const [sessionTreatmentCustom, setSessionTreatmentCustom] = useState<string>('');
  const [sessionRoute, setSessionRoute] = useState<string>('');
  const [sessionRouteCustom, setSessionRouteCustom] = useState<string>('');
  const [sessionAmount, setSessionAmount] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [sessionProcedurePlace, setSessionProcedurePlace] = useState<string>('');
  const [sessionProcedurePlaceCustom, setSessionProcedurePlaceCustom] = useState<string>('');

  // Attachment Lightbox Preview states
  const [previewAttachment, setPreviewAttachment] = useState<PatientAttachment | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewRotation, setPreviewRotation] = useState<number>(0);

   // Edit Patient modal states
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState(0);
  const [editSex, setEditSex] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [editPhone, setEditPhone] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editConsultant, setEditConsultant] = useState('');
  const [editTreatment, setEditTreatment] = useState('');
  const [editRoute, setEditRoute] = useState('');
  const [editProcedurePlace, setEditProcedurePlace] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editSessionNo, setEditSessionNo] = useState(1);
  const [editDate, setEditDate] = useState('');
  const [editRequiresFollowUp, setEditRequiresFollowUp] = useState(true);
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUps, setEditFollowUps] = useState<FollowUp[]>([]);
  const [editTreatmentSessions, setEditTreatmentSessions] = useState<TreatmentSession[]>([]);
  const [editAttachments, setEditAttachments] = useState<PatientAttachment[]>([]);

  const handleOpenEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setEditName(patient.name);
    setEditAge(patient.age);
    setEditSex(patient.sex);
    setEditPhone(patient.phone);
    setEditDiagnosis(patient.diagnosis);
    setEditConsultant(patient.consultant || settings.consultants[0] || 'Dr. Sarah Jenkins, MD');
    setEditTreatment(patient.treatment || settings.treatments[0] || 'Excedrin IV Dosing Protocol');
    setEditRoute(patient.route || settings.routes[0] || 'Intravenous (IV) Infusion');
    setEditProcedurePlace(patient.procedurePlace || (settings.procedurePlaces && settings.procedurePlaces[0]) || 'Operating Room A');
    setEditAmount(patient.amount);
    setEditSessionNo(patient.sessionNo);
    setEditDate(patient.date || '');
    setEditRequiresFollowUp(patient.requiresFollowUp !== false);
    setEditNotes(patient.notes || '');
    setEditFollowUps(patient.followUps ? [...patient.followUps] : []);
    setEditTreatmentSessions(patient.treatmentSessions ? [...patient.treatmentSessions] : []);
    setEditAttachments(patient.attachments ? [...patient.attachments] : []);
  };

  const handleEditAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File Size Alert: Selected file exceeds 15MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const newAttachment: PatientAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: dataUrl,
        uploadedAt: new Date().toISOString()
      };

      setEditAttachments((prev) => [...prev, newAttachment]);
    };
    reader.onerror = () => {
      alert('Error parsing uploaded file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = () => {
    if (!editingPatient) return;
    if (!editName.trim() || !editPhone.trim() || !editDiagnosis.trim()) {
      alert('Name, Phone Number, and Diagnosis are required fields.');
      return;
    }

    const updated: Patient = {
      ...editingPatient,
      name: editName.trim(),
      age: Number(editAge),
      sex: editSex,
      phone: editPhone.trim(),
      diagnosis: editDiagnosis,
      consultant: editConsultant,
      treatment: editTreatment,
      route: editRoute,
      procedurePlace: editProcedurePlace,
      amount: editAmount.trim(),
      sessionNo: Number(editSessionNo),
      date: editDate,
      requiresFollowUp: editRequiresFollowUp,
      notes: editNotes.trim(),
      followUps: editFollowUps,
      treatmentSessions: editTreatmentSessions,
      attachments: editAttachments
    };

    onUpdatePatient(updated);
    setEditingPatient(null);
  };

  const handleOpenAddSession = (patient: Patient) => {
    setSessionNo((patient.treatmentSessions?.length || 0) + 1);
    setSessionDate(new Date().toISOString().substring(0, 10)); // YYYY-MM-DD
    setSessionConsultant(patient.consultant || settings.consultants[0] || 'Dr. Sarah Jenkins, MD');
    setSessionConsultantCustom('');
    setSessionTreatment(patient.treatment || settings.treatments?.[0] || 'Excedrin IV Dosing Protocol');
    setSessionTreatmentCustom('');
    setSessionRoute(patient.route || settings.routes[0] || 'Intravenous (IV) Infusion');
    setSessionRouteCustom('');
    setSessionProcedurePlace(patient.procedurePlace || (settings.procedurePlaces && settings.procedurePlaces[0]) || 'Operating Room A');
    setSessionProcedurePlaceCustom('');
    setSessionAmount(patient.amount || '');
    setSessionNotes('');
    setShowAddSessionId(patient.id);
  };

  const handleSaveTreatmentSession = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    const finalConsultant = sessionConsultant === 'Other' ? sessionConsultantCustom.trim() : sessionConsultant;
    const finalTreatment = sessionTreatment === 'Other' ? sessionTreatmentCustom.trim() : sessionTreatment;
    const finalRoute = sessionRoute === 'Other' ? sessionRouteCustom.trim() : sessionRoute;
    const finalProcedurePlace = sessionProcedurePlace === 'Other' ? sessionProcedurePlaceCustom.trim() : sessionProcedurePlace;

    if (!finalConsultant) {
      alert('Consultant is required.');
      return;
    }
    if (!finalTreatment) {
      alert('Treatment Protocol is required.');
      return;
    }
    if (!finalRoute) {
      alert('Product Route is required.');
      return;
    }
    if (!sessionAmount.trim()) {
      alert('Product Dosage/Amount is required.');
      return;
    }

    const newSession = {
      id: crypto.randomUUID(),
      sessionNo: Number(sessionNo),
      date: sessionDate,
      consultant: finalConsultant,
      treatment: finalTreatment,
      route: finalRoute,
      procedurePlace: finalProcedurePlace || undefined,
      amount: sessionAmount.trim(),
      notes: sessionNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const currentSessions = patient.treatmentSessions || [];
    const updatedSessions = [newSession, ...currentSessions];

    onUpdatePatient({
      ...patient,
      sessionNo: Number(sessionNo),
      date: sessionDate,
      consultant: finalConsultant,
      treatment: finalTreatment,
      route: finalRoute,
      procedurePlace: finalProcedurePlace || undefined,
      amount: sessionAmount.trim(),
      treatmentSessions: updatedSessions
    });

    setShowAddSessionId(null);
  };

  const handleDeleteTreatmentSession = (patientId: string, sessionId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    const confirmDelete = window.confirm('Are you sure you want to delete this treatment session record?');
    if (!confirmDelete) return;

    const updatedSessions = (patient.treatmentSessions || []).filter(s => s.id !== sessionId);

    let updatedPatient = {
      ...patient,
      treatmentSessions: updatedSessions
    };

    if (updatedSessions.length > 0) {
      const latest = updatedSessions[0];
      updatedPatient = {
        ...updatedPatient,
        sessionNo: latest.sessionNo,
        date: latest.date,
        consultant: latest.consultant,
        treatment: latest.treatment,
        route: latest.route,
        procedurePlace: latest.procedurePlace,
        amount: latest.amount
      };
    }

    onUpdatePatient(updatedPatient);
  };

  // Sorting state variables
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'sessionNo' | 'updated'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Google Sheets integration states
  const [showSheetsPortal, setShowSheetsPortal] = useState(false);
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [sheetsAccessToken, setSheetsAccessToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [spreadsheetIdOrUrl, setSpreadsheetIdOrUrl] = useState(settings.activeSpreadsheetUrl || '');
  const [isSheetsLoading, setIsSheetsLoading] = useState(false);
  const [sheetsStatus, setSheetsStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'loading'; message: string }>({ type: 'idle', message: '' });
  const [createdSheetsList, setCreatedSheetsList] = useState<SpreadsheetMetadata[]>(() => {
    const raw = secureStorage.getItem('secure_ledger_created_sheets');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return [];
  });
  const [authMethod, setAuthMethod] = useState<'oauth' | 'manual'>('oauth');

  // Google Drive & Google Docs state variables
  const [driveBackups, setDriveBackups] = useState<any[]>([]);
  const [isDriveBackupsLoading, setIsDriveBackupsLoading] = useState(false);
  const [workspaceActiveTab, setWorkspaceActiveTab] = useState<'sheets' | 'drive' | 'docs'>('sheets');
  const [docExportUrl, setDocExportUrl] = useState<{ [patientId: string]: string }>({});
  const [isDocExporting, setIsDocExporting] = useState<{ [patientId: string]: boolean }>({});

  // Google Drive File Explorer states
  const [driveFiles, setDriveFiles] = useState<SpreadsheetMetadata[]>([]);
  const [isDriveFetching, setIsDriveFetching] = useState(false);
  const [driveError, setDriveError] = useState('');

  const handleFetchDriveFiles = async (token?: string | null) => {
    const activeToken = token || (authMethod === 'manual' ? manualToken.trim() : sheetsAccessToken);
    if (!activeToken) {
      setDriveError('Authorization requested: Connect your Google account first.');
      return;
    }
    setIsDriveFetching(true);
    setDriveError('');
    try {
      const files = await listSpreadsheetsInDrive(activeToken);
      setDriveFiles(files);
      if (files.length === 0) {
        setDriveError('No compatible spreadsheet files detected in Google Drive.');
      }
    } catch (err: any) {
      console.error(err);
      setDriveError(err.message || 'Failed to scan files inside Google Drive.');
    } finally {
      setIsDriveFetching(false);
    }
  };

  // Load the authenticated user on render
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setSheetsAccessToken(token);
        setSheetsStatus({ type: 'success', message: `Connected as ${user.email} (Ready for Google Sheets sync).` });
        handleFetchDriveFiles(token);
        handleFetchBackupFiles(token);
      },
      () => {
        setGoogleUser(null);
        setSheetsAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const saveCreatedSheets = (newSheets: SpreadsheetMetadata[]) => {
    setCreatedSheetsList(newSheets);
    secureStorage.setItem('secure_ledger_created_sheets', JSON.stringify(newSheets));
  };

  const getActiveToken = () => {
    return authMethod === 'manual' ? manualToken.trim() : sheetsAccessToken;
  };

  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const handleFetchBackupFiles = async (token?: string | null) => {
    const activeToken = token || (authMethod === 'manual' ? manualToken.trim() : sheetsAccessToken);
    if (!activeToken) return;
    setIsDriveBackupsLoading(true);
    try {
      const backups = await listBackupsInDrive(activeToken);
      setDriveBackups(backups);
    } catch (err: any) {
      console.error('Failed to load drive backups:', err);
    } finally {
      setIsDriveBackupsLoading(false);
    }
  };

  const handleBackupDatabaseToDrive = async () => {
    const token = getActiveToken();
    if (!token) {
      setSheetsStatus({ type: 'error', message: 'Access Denied: Please authorize via Google Sign-In or set a manual token first.' });
      return;
    }
    const confirmed = window.confirm(
      `SECURITY CONFIRMATION:\nYou are about to backup the active local patient database (${patients.length} patient records) onto your clinical Google Drive.\n\nDo you wish to proceed?`
    );
    if (!confirmed) return;

    // Secure Passphrase Prompt for AES-GCM encryption
    const passphrase = window.prompt(
      `ENCRYPTION PASSKEY REQUIREMENT:\nEnter a strong password/passphrase to lock and encrypt your clinical backup file.\n\nYou MUST memorize or retain this passphrase to restore/decrypt this file in the future!`,
      "ConcordClinicalSecret123!"
    );
    if (passphrase === null) return; // User clicked Cancel

    setIsSheetsLoading(true);
    setSheetsStatus({ type: 'loading', message: 'Generating clinical Backup file...' });
    try {
      const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/:/g, '-');
      const fileName = `Clinical Ledger Backup - ${timestamp}.json`;
      await backupDatabaseToDrive(token, patients, fileName, passphrase);
      setSheetsStatus({
        type: 'success',
        message: `Successfully backed up encrypted database to Google Drive as "${fileName}"!`
      });
      handleFetchBackupFiles(token);
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: `Drive Backup Error: ${err.message}`
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleRestoreDatabaseFromDrive = async (fileId: string, fileName: string) => {
    const token = getActiveToken();
    if (!token) {
      setSheetsStatus({ type: 'error', message: 'Access Denied: Please authorize via Google Sign-In or set a manual token first.' });
      return;
    }
    const confirmed = window.confirm(
      `CRITICAL VERIFICATION:\nYou are about to restore the local database from clinical backup "${fileName}" on Google Drive.\n\nTHIS WILL OVERWRITE AND MERGE CLINICAL DOSSIERS. Proceed with caution?`
    );
    if (!confirmed) return;

    setIsSheetsLoading(true);
    setSheetsStatus({ type: 'loading', message: `Retrieving and compiling database chunk from Drive...` });
    try {
      let restored: Patient[];
      try {
        // Try restoring. If it is encrypted, it throws prompting for password.
        restored = await restoreDatabaseFromDrive(token, fileId);
      } catch (err: any) {
        if (err.message.includes('encrypted') || err.message.includes('Decryption')) {
          const passphrase = window.prompt('This remote backup is encrypted. Please enter the correct decryption passphrase:');
          if (passphrase === null) {
            setIsSheetsLoading(false);
            setSheetsStatus({ type: 'error', message: 'Restore cancelled: Decryption passphrase is required.' });
            return;
          }
          restored = await restoreDatabaseFromDrive(token, fileId, passphrase);
        } else {
          throw err;
        }
      }

      await onImportPatients(restored);
      setSheetsStatus({
        type: 'success',
        message: `Database successfully restored. Loaded ${restored.length} patient records from backup file!`
      });
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: `Restore Failed: ${err.message}`
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleExportToDoc = async (patient: Patient) => {
    const token = getActiveToken();
    if (!token) {
      alert('Access Denied: Please authorize via Google Sign-In or set a manual token in the Sync panel first.');
      return;
    }

    setIsDocExporting(prev => ({ ...prev, [patient.id]: true }));
    try {
      const doc = await exportPatientProgressDoc(token, patient, settings);
      setDocExportUrl(prev => ({ ...prev, [patient.id]: doc.url }));
      setSheetsStatus({
        type: 'success',
        message: `Successfully created Google Document for "${patient.name}"!`
      });
    } catch (err: any) {
      console.error(err);
      alert(`Google Docs Export Failed: ${err.message}`);
    } finally {
      setIsDocExporting(prev => ({ ...prev, [patient.id]: false }));
    }
  };

  const handleGoogleLogin = async () => {
    setIsSheetsLoading(true);
    setSheetsStatus({ type: 'loading', message: 'Opening Google authentication portal...' });
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setSheetsAccessToken(result.accessToken);
        setSheetsStatus({
          type: 'success',
          message: `Authenticated successfully as ${result.user.email}!`
        });
        handleFetchDriveFiles(result.accessToken);
        handleFetchBackupFiles(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: err.message || 'Google Auth login popup failed. Please use are manual token fallback if required.'
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleGoogleLogoutClick = async () => {
    setIsSheetsLoading(true);
    try {
      await googleLogout();
      setGoogleUser(null);
      setSheetsAccessToken(null);
      setSheetsStatus({ type: 'idle', message: 'Logged out of Google Services.' });
    } catch (err: any) {
      setSheetsStatus({ type: 'error', message: 'Logout failed: ' + err.message });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleApplyManualToken = () => {
    if (!manualToken.trim()) {
      setSheetsStatus({ type: 'error', message: 'Please enter a valid Google OAuth access token first.' });
      return;
    }
    setManualAccessToken(manualToken.trim());
    setSheetsStatus({
      type: 'success',
      message: 'Custom access token registered in memory!'
    });
  };

  const handleCreateAndExportSheet = async () => {
    const token = getActiveToken();
    if (!token) {
      setSheetsStatus({ type: 'error', message: 'Access Denied: Please authorize via Google Sign-In or set a manual token first.' });
      return;
    }

    if (patients.length === 0) {
      setSheetsStatus({ type: 'error', message: 'No patient records exist in current safe ledger to export.' });
      return;
    }

    const confirmed = window.confirm(
      `SECURITY CONFIRMATION:\nYou are about to export ${patients.length} patient records (including diagnoses, treatment history, and clinical parameters) onto a freshly generated Google Spreadsheet.\n\nThis will transfer records from this safe to Google Drive. Do you wish to proceed?`
    );
    if (!confirmed) return;

    setIsSheetsLoading(true);
    setSheetsStatus({ type: 'loading', message: 'Provisioning new Google Spreadsheet...' });

    try {
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const meta = await createSpreadsheet(token, `Clinical Cohort Patient Ledger - ${dateStr}`);
      
      setSheetsStatus({ type: 'loading', message: 'Exporting tabular dossiers to cells...' });
      const rows = mapPatientsToSheetRows(patients);
      
      // Update Sheet1 values
      await updateSpreadsheetValues(token, meta.id, 'Sheet1!A1', rows);

      // Save spreadsheet reference
      const newSheetItem: SpreadsheetMetadata = {
        id: meta.id,
        title: meta.title,
        url: meta.url
      };
      
      const updatedList = [newSheetItem, ...createdSheetsList.filter(s => s.id !== meta.id)].slice(0, 5);
      saveCreatedSheets(updatedList);
      setSpreadsheetIdOrUrl(meta.url);

      setSheetsStatus({
        type: 'success',
        message: `Successfully generated: "${meta.title}". Records pushed seamlessly!`
      });
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: `Google Sheets API Error: ${err.message}`
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleCreateAndExportOutcomeReport = async () => {
    const token = getActiveToken();
    if (!token) {
      setSheetsStatus({ type: 'error', message: 'Access Denied: Please authorize via Google Sign-In or set a manual token first.' });
      return;
    }

    if (patients.length === 0) {
      setSheetsStatus({ type: 'error', message: 'No patient records exist in current safe ledger to generate outcome report.' });
      return;
    }

    const confirmed = window.confirm(
      `OUTCOME REPORT GENERATOR:\nYou are about to generate a formatted Clinical Outcome Report containing recovery rates, progress metrics and case demographics for health managers.\n\nDo you wish to proceed?`
    );
    if (!confirmed) return;

    setIsSheetsLoading(true);
    setSheetsStatus({ type: 'loading', message: 'Compiling metrics & formatting Google Sheet...' });

    try {
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const meta = await exportPatientOutcomesReport(token, patients, `Clinical Outcome Report - ${dateStr}`);
      
      const newSheetItem: SpreadsheetMetadata = {
        id: meta.id,
        title: meta.title,
        url: meta.url
      };
      
      const updatedList = [newSheetItem, ...createdSheetsList.filter(s => s.id !== meta.id)].slice(0, 5);
      saveCreatedSheets(updatedList);
      setSpreadsheetIdOrUrl(meta.url);

      setSheetsStatus({
        type: 'success',
        message: `Outcome Report generated successfully: "${meta.title}"!`
      });
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: `Outcome Report Generation Error: ${err.message}`
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleSyncToExistingSheet = async () => {
    const token = getActiveToken();
    if (!token) {
      setSheetsStatus({ type: 'error', message: 'Access Denied: Please authorize via Google Sign-In or set a manual token first.' });
      return;
    }

    if (!spreadsheetIdOrUrl.trim()) {
      setSheetsStatus({ type: 'error', message: 'Please provide a Google Spreadsheet URL or Spreadsheet ID.' });
      return;
    }

    if (patients.length === 0) {
      setSheetsStatus({ type: 'error', message: 'No records exist in the active safe database to synchronize.' });
      return;
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
    
    const confirmed = window.confirm(
      `SECURITY MUTATION CONFIRMATION:\nThis action will overwrite data on the designated spreadsheet (Sheet1 tab) with your current ${patients.length} clinicians' dossiers.\n\nAre you sure you want to proceed and modify this external document?`
    );
    if (!confirmed) return;

    setIsSheetsLoading(true);
    setSheetsStatus({ type: 'loading', message: 'Synching and pushing clinic data to Spreadsheet...' });

    try {
      const rows = mapPatientsToSheetRows(patients);
      await updateSpreadsheetValues(token, spreadsheetId, 'Sheet1!A1', rows);

      setSheetsStatus({
        type: 'success',
        message: 'Google Spreadsheet written and fully synchronized!'
      });
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: `Sync Failed: ${err.message}. Double-check that your spreadsheet is shared/accessible to the authenticated Google Account.`
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleImportFromSheet = async () => {
    const token = getActiveToken();
    if (!token) {
      setSheetsStatus({ type: 'error', message: 'Access Denied: Please authorize via Google Sign-In or set a manual token first.' });
      return;
    }

    if (!spreadsheetIdOrUrl.trim()) {
      setSheetsStatus({ type: 'error', message: 'Please enter the URL or ID of the Google Spreadsheet to pull from.' });
      return;
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
    setIsSheetsLoading(true);
    setSheetsStatus({ type: 'loading', message: 'Fetching rows from Google Sheets API...' });

    try {
      // Pull rows from Sheet1
      const values = await getSpreadsheetValues(token, spreadsheetId, 'Sheet1!A1:N1000');
      if (!values || values.length <= 1) {
        throw new Error('Spreadsheet appears empty or missing a valid header row on "Sheet1".');
      }

      const importedPatients = mapSheetRowsToPatients(values);
      if (importedPatients.length === 0) {
        throw new Error('No valid patient rows could be mapped. See if columns matches required attributes.');
      }

      // Add to patient database
      await onImportPatients(importedPatients);

      setSheetsStatus({
        type: 'success',
        message: `Successfully fetched and cryptographically sealed ${importedPatients.length} patient records!`
      });
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: `Import Failed: ${err.message}. Verify document permissions and check sheet structure.`
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleLaunchFromDriveSheet = async (sheetId: string, sheetTitle: string, sheetUrl: string) => {
    const token = getActiveToken();
    if (!token) {
      setSheetsStatus({ type: 'error', message: 'Credentials expired or disconnected. Re-authenticate first.' });
      return;
    }

    const confirmed = window.confirm(
      `LAUNCH CONFIRMATION:\nYou are about to launch your clinical dashboard from Google Drive spreadsheet: "${sheetTitle}".\n\nThis will synchronize and import all patients from this file. Proceed?`
    );
    if (!confirmed) return;

    setIsSheetsLoading(true);
    setSheetsStatus({ type: 'loading', message: `Launching session from Drive spreadsheet: "${sheetTitle}"...` });

    try {
      // 1. Read rows from Sheet1 of this spreadsheet
      const values = await getSpreadsheetValues(token, sheetId, 'Sheet1!A1:N1000');
      
      let importedPatients: Patient[] = [];
      if (values && values.length > 1) {
        importedPatients = mapSheetRowsToPatients(values);
      } else {
        // If sheet is empty, offer to initialize it
        const initConfirm = window.confirm(
          `Empty Spreadsheet Detected:\n"${sheetTitle}" does not contain any clinical data.\n\nWould you like to initialize it with your current local patient dataset?`
        );
        if (initConfirm && patients.length > 0) {
          const rows = mapPatientsToSheetRows(patients);
          await updateSpreadsheetValues(token, sheetId, 'Sheet1!A1', rows);
          importedPatients = patients;
        }
      }

      // 2. Clear & import patients locally & to backend server
      await onImportPatients(importedPatients);

      // 3. Update local input field
      setSpreadsheetIdOrUrl(sheetUrl);

      // 4. Update settings
      if (onUpdateSettings) {
        onUpdateSettings({
          ...settings,
          activeSpreadsheetUrl: sheetUrl
        });
      }

      setSheetsStatus({
        type: 'success',
        message: `Dashboard launched successfully from Google Drive! Loaded ${importedPatients.length} records.`
      });
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: `Failed to launch from sheet: ${err.message}. Verify that a sheet tab named "Sheet1" exists.`
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  // Excel Import states
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [parsedPreview, setParsedPreview] = useState<Patient[]>([]);

  // Sharing states
  const [sharingPatientId, setSharingPatientId] = useState<string | null>(null);
  const [isAnonymized, setIsAnonymized] = useState(true);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  // Printing/PDF states
  const [printingPatientId, setPrintingPatientId] = useState<string | null>(null);
  const printingPatient = useMemo(() => {
    return patients.find(p => p.id === printingPatientId) || null;
  }, [patients, printingPatientId]);

  const isDark = activeTheme.isDark;

  // Custom text labels
  const labelPatientCode = settings.labelPatientCode || 'Patient Code/ID';
  const labelPatientName = settings.labelPatientName || 'Patient Full Name';
  const labelAge = settings.labelAge || 'Patient Age';
  const labelSex = settings.labelSex || 'Biological Sex';
  const labelPhone = settings.labelPhone || 'Contact Telephone';
  const labelDiagnosis = settings.labelDiagnosis || 'Admitting Diagnosis';
  const labelConsultant = settings.labelConsultant || 'Attending Consultant';
  const labelTreatment = settings.labelTreatment || 'Active Treatment Protocol';
  const labelRoute = settings.labelRoute || 'Product Route';
  const labelAmount = settings.labelAmount || 'Product Dosage';
  const labelNotes = settings.labelNotes || 'Clinical Notes & Observations';

  // Custom section headlines
  const headlineAdmission = settings.headlineAdmission || 'Patient Admission Record';
  const headlineDemographics = settings.headlineDemographics || '1. Core Patient Demographics';
  const headlineParameters = settings.headlineParameters || '2. Clinical Parameters & Protocols';
  const headlineRemarks = settings.headlineRemarks || '3. Admitting Practitioner Remarks';
  const headlineFollowUpTitle = settings.headlineFollowUpTitle || '4. Follow-Up Assessment Timeline';

  // File Attachment Upload handler
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>, patientId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File Size Alert: Selected file exceeds 15MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const targetPatient = patients.find(p => p.id === patientId);
      if (!targetPatient) return;

      const currentAttachments = targetPatient.attachments || [];
      const newAttachment: PatientAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: dataUrl,
        uploadedAt: new Date().toISOString()
      };

      onUpdatePatient({
        ...targetPatient,
        attachments: [...currentAttachments, newAttachment]
      });
    };
    reader.onerror = () => {
      alert('Error parsing uploaded file attachment.');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = (patientId: string, attachmentId: string) => {
    const targetPatient = patients.find(p => p.id === patientId);
    if (!targetPatient) return;

    if (!confirm(`Are you sure you want to permanently delete this file?`)) return;

    const currentAttachments = targetPatient.attachments || [];
    const updated = currentAttachments.filter(a => a.id !== attachmentId);

    onUpdatePatient({
      ...targetPatient,
      attachments: updated
    });
  };

  const handleDownloadAttachment = (attachment: PatientAttachment) => {
    try {
      const link = document.createElement('a');
      link.href = attachment.data;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Unable to extract file attachment payload.');
    }
  };

  // CSV template downloader
  const downloadCSVTemplate = () => {
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
    ].join(',');
    
    const sampleRow = [
      'Alexander Fleming',
      'PAT-2026-0482',
      '55',
      'Male',
      '+1 (555) 019-2831',
      'Bacterial Infection Protocol',
      'Dr. Sarah Jenkins, MD',
      'Penicillin G Infusion',
      'Intravenous (IV) Infusion',
      '100 mL',
      '3',
      '2026-05-29',
      'Improved',
      'Administered Penicillin cycle. High tolerability recorded with low radicular load.'
    ].map(val => `"${val.replace(/"/g, '""')}"`).join(',');

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(`${headers}\n${sampleRow}`);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'patient_database_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Excel/CSV parse reader
  const handleSpreadsheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ type: 'idle', message: '' });
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new Error('Spreadsheet worksheet is empty or could not be loaded.');
        }

        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
        if (rawRows.length === 0) {
          throw new Error('No client rows detected in the clinical spreadsheet.');
        }

        const newlySanitizedPatients: Patient[] = rawRows.map((row, index) => {
          const getVal = (aliases: string[]): string => {
            const keys = Object.keys(row);
            const foundKey = keys.find(k => 
              aliases.some(alias => k.toLowerCase().replace(/[\s_]/g, '') === alias.toLowerCase().replace(/[\s_]/g, ''))
            );
            return foundKey ? String(row[foundKey]).trim() : '';
          };

          const name = getVal(['name', 'fullname', 'patientname', 'patient', 'nombre']) || `Imported Patient #${index + 1}`;
          const codeVal = getVal(['code', 'patientcode', 'recordid', 'id', 'dossier', 'codepatient']);
          const code = codeVal || `PAT-IMP-${Math.floor(1000 + Math.random() * 9000)}`;
          
          const ageVal = parseInt(getVal(['age', 'years', 'edad', 'ageval']), 10);
          const age = isNaN(ageVal) ? 30 : ageVal;

          const sexVal = getVal(['sex', 'gender', 'biologicalsex', 'gendersex', 'sexo']).toLowerCase();
          let sex: Patient['sex'] = 'Other';
          if (sexVal.startsWith('m')) sex = 'Male';
          else if (sexVal.startsWith('f')) sex = 'Female';

          const phone = getVal(['phone', 'phonenumber', 'number', 'tel', 'telefono']) || 'N/A';
          const diagnosis = getVal(['diagnosis', 'condition', 'illness', 'disease', 'diagnóstico', 'clinicalcondition']) || 'Routine Protocol Evaluation';
          const consultant = getVal(['consultant', 'attendingconsultant', 'doctor', 'physician', 'md', 'cardiologist', 'neurologist']) || 'Dr. Eleanor Vance, MD';
          const treatment = getVal(['treatment', 'protocol', 'activetreatment', 'medicine', 'drug']) || 'Observation Support';
          const route = getVal(['route', 'routeofadministration', 'adminroute', 'location']) || 'Oral';
          const amount = getVal(['amount', 'dosage', 'dose', 'qty']) || 'As Prescribed';
          
          const sessionVal = parseInt(getVal(['session', 'sessionno', 'sessionnumber', 'sessions']), 10);
          const sessionNo = isNaN(sessionVal) ? 1 : sessionVal;

          const dateVal = getVal(['date', 'admissiondate', 'entrydate', 'fecha', 'createdat']);
          const date = dateVal || new Date().toISOString().split('T')[0];

          const impVal = getVal(['improvement', 'improvementstatus', 'status', 'progress', 'mejora']).toLowerCase();
          let improvement: Patient['improvement'] = 'Stable';
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

          const notes = getVal(['notes', 'remarks', 'comments', 'clinicalnotes', 'observaciones']) || 'Bulk imported via secure spreadsheet portal.';

          return {
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
          };
        });

        setParsedPreview(newlySanitizedPatients);
        setImportStatus({
          type: 'success',
          message: `Successfully decrypted and mapped ${newlySanitizedPatients.length} history dossiers.`
        });
      } catch (err: any) {
        setImportStatus({
          type: 'error',
          message: err.message || 'Spreadsheet formatting is corrupted or unreadable.'
        });
      }
    };

    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'FileReader failure processing Excel database.' });
    };

    reader.readAsArrayBuffer(file);
  };

  // Commit imported records
  const handleCommitImport = async () => {
    if (parsedPreview.length === 0) return;
    try {
      await onImportPatients(parsedPreview);
      setImportStatus({
        type: 'idle',
        message: ''
      });
      setParsedPreview([]);
      setShowImport(false);
      alert(`Database updated! Registered ${parsedPreview.length} records client-side.`);
    } catch (e: any) {
      alert(`Import failure: ${e.message}`);
    }
  };

  // Structural details text generator for WhatsApp/Messenger/Telegram direct dispatching
  const generateShareText = (p: Patient, anonymizeDetails: boolean) => {
    const headerTitle = anonymizeDetails ? 'EHR CONFIDENTIAL SUMMARY (ANONYMISED)' : 'EHR RESTRICTED CLINICAL REPORT';
    const finalName = anonymizeDetails 
      ? p.name.split(' ').map(n => n[0]).join('.') + '*****' 
      : p.name;
    const finalPhone = anonymizeDetails ? 'REDACTED/ENCRYPTED' : p.phone;

    const followUpsText = p.followUps.length === 0 
      ? 'No intermediate follow-ups logged.'
      : p.followUps.map((f, idx) => `  * [${formatDateToDDMMYYYY(f.date)}] Session Result: ${f.status} (by Dr. ${f.clinician})`).join('\n');

    const sessionsText = (!p.treatmentSessions || p.treatmentSessions.length === 0)
      ? 'No treatment sessions logged.'
      : p.treatmentSessions.map((s) => `  * [${formatDateToDDMMYYYY(s.date)}] Session #${s.sessionNo}: ${s.treatment} | Dose: ${s.amount} (${s.route}) | Dr. ${s.consultant}`).join('\n');

    const divider = '========================================';

    return `*${headerTitle}*
${divider}
Patient Registry Code: ${p.code}
Display Identity: ${finalName}
Biological Sex: ${p.sex} | Patient Age: ${p.age} years
Contact Telephone: ${finalPhone}

Clinical Details:
- ${labelDiagnosis}: ${p.diagnosis}
- ${labelConsultant}: ${p.consultant}
- ${labelTreatment}: ${p.treatment}
- Route & Dosage: ${p.amount} via ${p.route}
- Active Session No: ${p.sessionNo}
- Treatment Date: ${formatDateToDDMMYYYY(p.date)}
- Improvement Progress: ${p.improvement}

Practitioner Remarks:
${p.notes || 'No remarks provided.'}

Treatment Sessions Chronology:
${sessionsText}

Longitudinal Consultation Timeline:
${followUpsText}
${divider}
AES-256 Secured Clinical Client-Side Dispatch`;
  };

  // Direct Social Share Router
  const handleShareSocial = (channel: 'whatsapp' | 'messenger' | 'telegram' | 'email' | 'copy', p: Patient, anonymized: boolean) => {
    const text = generateShareText(p, anonymized);
    const encodedText = encodeURIComponent(text);

    switch (channel) {
      case 'whatsapp':
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
        break;
      case 'telegram':
        window.open(`https://telegram.me/share/url?url=${encodeURIComponent('https://cryptoguard.ehr')}&text=${encodedText}`, '_blank');
        break;
      case 'email':
        const subject = anonymized 
          ? `Anonymized Clinical Update: [${p.code}]`
          : `Confidential Patient Clinical File: ${p.name} (${p.code})`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodedText}`, '_blank');
        break;
      case 'messenger':
        // Messenger requires web shares or copy clipboard fallback
        navigator.clipboard.writeText(text);
        setCopySuccessId(p.id);
        setTimeout(() => setCopySuccessId(null), 3000);
        alert(`Social Share Dispatch:\nFacebook Messenger does not support direct text intents on generic ports. The full structured EHR markdown dossier has been copied to your clipboard! Please paste it directly into Messenger.`);
        break;
      case 'copy':
        navigator.clipboard.writeText(text);
        setCopySuccessId(p.id);
        setTimeout(() => setCopySuccessId(null), 3000);
        break;
      default:
        break;
    }
  };

  // Compute live matches
  const filteredPatients = useMemo(() => {
    const list = patients.filter((p) => {
      const query = searchTerm.toLowerCase().trim();
      
      const matchesDiagnosis = filterDiagnosis === 'All' || p.diagnosis === filterDiagnosis;
      const matchesImprovement = filterImprovement === 'All' || p.improvement === filterImprovement;
      const matchesConsultant = filterConsultant === 'All' || p.consultant === filterConsultant;
      const matchesRoute = filterRoute === 'All' || p.route === filterRoute;

      if (!query) return matchesDiagnosis && matchesImprovement && matchesConsultant && matchesRoute;

      const formattedPDate = p.date ? formatDateToDDMMYYYY(p.date).toLowerCase() : '';
      const rawPDate = p.date ? p.date.toLowerCase() : '';

      const sessionDatesMatch = p.treatmentSessions?.some(s => {
        const dStr = s.date.toLowerCase();
        const fStr = formatDateToDDMMYYYY(s.date).toLowerCase();
        return dStr.includes(query) || fStr.includes(query);
      }) || false;

      const matchesSearch =
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.phone.includes(query) ||
        p.diagnosis.toLowerCase().includes(query) ||
        p.consultant.toLowerCase().includes(query) ||
        formattedPDate.includes(query) ||
        rawPDate.includes(query) ||
        sessionDatesMatch;

      return matchesSearch && matchesDiagnosis && matchesImprovement && matchesConsultant && matchesRoute;
    });

    // Sort list dynamically based on sortBy criteria and sortOrder direction
    return list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'date') {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortBy === 'sessionNo') {
        comparison = (a.sessionNo || 0) - (b.sessionNo || 0);
      } else if (sortBy === 'updated') {
        const getLatestActivity = (p: Patient) => {
          let latest = p.date ? new Date(p.date).getTime() : 0;
          if (isNaN(latest)) latest = p.createdAt ? new Date(p.createdAt).getTime() : 0;
          if (isNaN(latest)) latest = 0;
          
          if (p.treatmentSessions && p.treatmentSessions.length > 0) {
            p.treatmentSessions.forEach(s => {
              const t = s.date ? new Date(s.date).getTime() : 0;
              if (!isNaN(t) && t > latest) latest = t;
            });
          }
          if (p.followUps && p.followUps.length > 0) {
            p.followUps.forEach(f => {
              const t = f.date ? new Date(f.date).getTime() : 0;
              if (!isNaN(t) && t > latest) latest = t;
            });
          }
          return latest;
        };
        comparison = getLatestActivity(a) - getLatestActivity(b);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [patients, searchTerm, filterDiagnosis, filterImprovement, filterConsultant, filterRoute, sortBy, sortOrder]);

  const toggleExpand = (id: string) => {
    setExpandedPatientId(expandedPatientId === id ? null : id);
  };

  const handleExportExcel = () => {
    try {
      if (patients.length === 0) {
        alert('No patient records exist to export.');
        return;
      }

      // Map patients to flat rows for excel export
      const patientRows = patients.map((p, index) => ({
        '#': index + 1,
        'Patient Code/ID': p.code,
        'Patient Full Name': p.name,
        'Age': p.age,
        'Biological Sex': p.sex,
        'Contact Telephone': p.phone,
        'Admitting Diagnosis': p.diagnosis,
        'Active Treatment Protocol': p.treatment || '',
        'Product Route': p.route || '',
        'Product Dosage': p.amount || '',
        'Session # / Total': p.sessionNo || 1,
        'Date of Admission': p.date || '',
        'Dynamic Improvement Status': p.improvement || 'Stable',
        'Post-Treatment Follow-up Tracker': p.requiresFollowUp !== false ? 'ENABLED' : 'DISABLED',
        'Clinician Comments': p.notes || '',
        'Registration Date': p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''
      }));

      // Gather ALL follow-up evaluations across all patients to build a historical worksheet
      const followUpRows: any[] = [];
      patients.forEach(p => {
        if (p.followUps && p.followUps.length > 0) {
          p.followUps.forEach(f => {
            followUpRows.push({
              'Patient Code': p.code,
              'Patient Name': p.name,
              'Evaluation Date': f.date,
              'Follow-Up Session': f.sessionNo || '',
              'Clinical Status': f.status || '',
              'EHR Evaluation Remarks': f.notes || '',
              'Evaluating Clinician': f.clinician || ''
            });
          });
        }
      });

      // Gather ALL treatment sessions historically
      const sessionRows: any[] = [];
      patients.forEach(p => {
        if (p.treatmentSessions && p.treatmentSessions.length > 0) {
          p.treatmentSessions.forEach(s => {
            sessionRows.push({
              'Patient Code': p.code,
              'Patient Name': p.name,
              'Session Number': s.sessionNo,
              'Therapeutic Date': s.date,
              'Attending Consultant': s.consultant,
              'Treatment Administered': s.treatment,
              'Product Route': s.route,
              'Dosage/Amount': s.amount,
              'Intervention Notes': s.notes || ''
            });
          });
        }
      });

      // Prepare multi-sheet workbook
      const wb = XLSX.utils.book_new();
      
      const patSheet = XLSX.utils.json_to_sheet(patientRows);
      XLSX.utils.book_append_sheet(wb, patSheet, 'Patient Registry');

      if (followUpRows.length > 0) {
        const fupSheet = XLSX.utils.json_to_sheet(followUpRows);
        XLSX.utils.book_append_sheet(wb, fupSheet, 'Follow-up Assessments');
      }

      if (sessionRows.length > 0) {
        const sesSheet = XLSX.utils.json_to_sheet(sessionRows);
        XLSX.utils.book_append_sheet(wb, sesSheet, 'Treatment Session Logs');
      }

      // Save workbook to local file download
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `EHR_Clinical_Cohort_Ledger_${dateStr}.xlsx`);
    } catch (err: any) {
      alert(`Export Failed: ${err.message || err}`);
    }
  };

  const getStatusColor = (improvement: Patient['improvement']) => {
    switch (improvement) {
      case 'Significantly Improved':
        return isDark 
          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50' 
          : 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'Improved':
        return isDark 
          ? 'bg-blue-950/40 text-blue-300 border-blue-900/50' 
          : 'bg-blue-50 text-blue-700 border-blue-200/50';
      case 'Stable':
        return isDark 
          ? 'bg-slate-950/40 text-slate-300 border-slate-800' 
          : 'bg-slate-100 text-slate-700 border-slate-200/60';
      case 'Unchanged':
        return isDark 
          ? 'bg-amber-950/40 text-amber-300 border-amber-900/50' 
          : 'bg-amber-50 text-amber-700 border-amber-200/50';
      case 'Deteriorated':
        return isDark 
          ? 'bg-rose-950/40 text-rose-300 border-rose-900/50' 
          : 'bg-rose-50 text-rose-700 border-rose-200/50';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200/50';
    }
  };

  // Dynamic stats derivations for top KPI dashboard
  const totalCohorts = patients.length;
  const activeFollowUpsCount = patients.filter(p => p.requiresFollowUp !== false).length;
  const totalTherapeuticSessions = patients.reduce((acc, p) => acc + (p.treatmentSessions?.length || p.sessionNo || 1), 0);
  const significantImprovementCount = patients.filter(p => p.improvement === 'Significantly Improved' || p.improvement === 'Improved').length;
  const efficacyEfficacyIndex = totalCohorts > 0 ? Math.round((significantImprovementCount / totalCohorts) * 105) : 0;
  const cappedEfficacyRate = Math.min(efficacyEfficacyIndex, 100);

  return (
    <div id="patient_list_section" className="space-y-6 font-sans">
      {/* Search & Filter Header */}
      <div 
        className={`border rounded-3xl p-6 shadow-sm space-y-4 ${
          isDark ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-100'
        }`}
        style={{ paddingBottom: '15px', paddingTop: '15px', marginBottom: '15px' }}
      >
        <div 
          onClick={() => setSearchExpanded(!searchExpanded)}
          className={`flex items-center justify-between gap-3 select-none cursor-pointer ${
            searchExpanded ? 'border-b pb-3' : ''
          } ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Search className={`h-4 w-4 shrink-0 ${searchExpanded ? activeTheme.primaryText : 'text-slate-405'}`} />
            <h3 className={`text-sm font-bold uppercase tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              Search & Filters
            </h3>
            
            {!searchExpanded && (
              <div className="hidden sm:flex items-center gap-1.5 flex-wrap ml-4 min-w-0 truncate">
                {searchTerm && (
                  <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2.5 py-0.5 rounded-full font-bold truncate">
                    Query: "{searchTerm}"
                  </span>
                )}
                {filterDiagnosis !== 'All' && (
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-500 px-2.5 py-0.5 rounded-full font-bold truncate">
                    {filterDiagnosis}
                  </span>
                )}
                {filterImprovement !== 'All' && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full font-bold truncate">
                    {filterImprovement}
                  </span>
                )}
                {filterConsultant !== 'All' && (
                  <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2.5 py-0.5 rounded-full font-bold truncate">
                    {filterConsultant}
                  </span>
                )}
                {filterRoute !== 'All' && (
                  <span className="text-[10px] bg-teal-500/10 text-teal-500 px-2.5 py-0.5 rounded-full font-bold truncate">
                    {filterRoute}
                  </span>
                )}
                {!searchTerm && filterDiagnosis === 'All' && filterImprovement === 'All' && filterConsultant === 'All' && filterRoute === 'All' && (
                  <span className="text-[10px] text-slate-400 font-bold normal-case">
                    Click to configure filter criteria
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              id="export_excel_dossier_btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleExportExcel();
              }}
              className="p-2 border rounded-xl flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-green-500 hover:bg-green-500/10 hover:border-green-505 transition-all border-slate-700/40"
              title="Download Entire EHR Dataset as Excel Spreadsheet"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export Registry</span>
            </button>
            <div className={`p-1 rounded-xl transition-all ${
              isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}>
              <ChevronDown className={`h-4.5 w-4.5 transform transition-transform duration-205 ${searchExpanded ? 'rotate-180' : 'rotate-0'}`} />
            </div>
          </div>
        </div>

        {showImport && userRole !== 'user' && (
          <div className={`border rounded-2xl p-5 space-y-4 animate-fade-in font-sans ${
            isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/55 border-slate-200/60'
          }`}>
            <div className="flex flex-col gap-1">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-250' : 'text-slate-700'}`}>
                Spreadsheet Database Migration
              </h4>
              <p className="text-[10px] text-slate-400">Load high-volume clinical records instantly. Files are parsed 100% locally on your machine.</p>
            </div>

            {/* Drag and Drop Zone */}
            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors relative cursor-pointer ${
              isDark ? 'border-slate-800 hover:border-blue-400 bg-slate-950' : 'border-slate-200 hover:border-blue-400 bg-white'
            }`}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleSpreadsheetUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-slate-400" />
                <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Drag & Drop file or click to browse</p>
                <p className="text-[10px] text-slate-400 font-mono">Supports Excel (.xlsx, .xls) and CSV spreadsheets</p>
              </div>
            </div>

            {/* Status alerts */}
            {importStatus.type !== 'idle' && (
              <div className={`p-4 rounded-xl flex items-start gap-2.5 text-xs font-medium border ${
                importStatus.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100/70' 
                  : 'bg-rose-50 text-rose-800 border-rose-100/70'
              }`}>
                {importStatus.type === 'success' ? (
                  <CheckSquare className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{importStatus.type === 'success' ? 'Records Decrypted & Mapped' : 'Import Processing Error'}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{importStatus.message}</p>
                </div>
              </div>
            )}

            {/* Preview list */}
            {parsedPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Admissions Audit Preview ({parsedPreview.length} cases detected)</span>
                </div>
                
                <div className={`max-h-52 overflow-y-auto border rounded-xl divide-y ${
                  isDark ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200/50 divide-slate-100'
                }`}>
                  {parsedPreview.map((p, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/5">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-bold shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{p.name}</span>
                          <span className="font-mono text-[9px] text-slate-400 font-bold bg-slate-50 border px-1.5 py-0.5 rounded-full">{p.code}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 truncate">
                          Age {p.age} &middot; {p.sex} &middot; {p.diagnosis}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium text-slate-400 italic">Ready to map</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleCommitImport}
                    className={`px-4 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    Commit {parsedPreview.length} Dossiers to Ledger
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {showSheetsPortal && (
          <div className={`border rounded-2xl p-6 space-y-5 animate-fade-in font-sans ${
            isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/55 border-slate-200/60'
          }`}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-800/40 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-emerald-500" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-205' : 'text-slate-800'}`}>
                    Google Workspace Cloud Integration
                  </h4>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200/30">
                    Enterprise Secure
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Securely link your clinical ledger to Google Workspace services (Sheets, Drive Backups, and narrative Docs) via authenticated endpoints.
                </p>
              </div>
              <button 
                onClick={() => setShowSheetsPortal(false)}
                className="text-slate-450 hover:text-slate-650 cursor-pointer p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Integration Portal Tab Navigation Header */}
            <div className="flex border-b border-slate-850 dark:border-slate-800 pb-2 mb-4 gap-4">
              <button
                type="button"
                onClick={() => setWorkspaceActiveTab('sheets')}
                className={`pb-1.5 px-1.5 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  workspaceActiveTab === 'sheets'
                    ? 'border-emerald-500 text-emerald-400 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-slate-350'
                }`}
              >
                📊 Google Sheets Sync
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorkspaceActiveTab('drive');
                  handleFetchBackupFiles();
                }}
                className={`pb-1.5 px-1.5 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  workspaceActiveTab === 'drive'
                    ? 'border-emerald-500 text-emerald-400 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-slate-350'
                }`}
              >
                🗄️ Google Drive Backups
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceActiveTab('docs')}
                className={`pb-1.5 px-1.5 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  workspaceActiveTab === 'docs'
                    ? 'border-emerald-500 text-emerald-400 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-slate-350'
                }`}
              >
                📝 Narrative Google Docs
              </button>
            </div>

            {/* Auth strategy & Workspace Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
              {/* Identity authorization column */}
              <div className="lg:col-span-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
                    Identity Gateway
                  </label>
                  <div className="flex border rounded-lg overflow-hidden p-0.5">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('oauth')}
                      className={`px-2 py-0.75 text-[9px] font-bold uppercase tracking-wider rounded-md cursor-pointer ${
                        authMethod === 'oauth' 
                          ? 'bg-slate-800 text-white' 
                          : 'text-slate-500 hover:text-slate-750'
                      }`}
                    >
                      Auth Sign-In
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMethod('manual')}
                      className={`px-2 py-0.75 text-[9px] font-bold uppercase tracking-wider rounded-md cursor-pointer ${
                        authMethod === 'manual' 
                          ? 'bg-slate-800 text-white' 
                          : 'text-slate-500 hover:text-slate-750'
                      }`}
                    >
                      Manual Key
                    </button>
                  </div>
                </div>

                {authMethod === 'oauth' ? (
                  <div className={`p-4 rounded-xl space-y-3 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200/50'}`}>
                    {googleUser && sheetsAccessToken ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-[11px] font-bold text-slate-400">Credential Connected</p>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${activeTheme.primaryBg} text-white`}>
                            {googleUser.email ? googleUser.email.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-slate-205">{googleUser.displayName || 'Authorized Clinician'}</p>
                            <p className="text-[10px] text-slate-400 truncate">{googleUser.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={handleGoogleLogoutClick}
                          disabled={isSheetsLoading}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border rounded-lg text-rose-500 hover:bg-rose-50/5 border-rose-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <LogOut className="h-3 w-3" /> Disconnect Session
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6 space-y-3">
                        <div className="h-10 w-10 mx-auto rounded-full bg-emerald-100/10 flex items-center justify-center">
                          <Lock className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold">Unauthenticated Gate</p>
                          <p className="text-[10px] text-slate-400">Sign in with Google to grant Sheets, Docs & Drive active scopes.</p>
                        </div>
                        
                        <button
                          onClick={handleGoogleLogin}
                          disabled={isSheetsLoading}
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 border rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50/5 transition-all text-slate-200 cursor-pointer"
                          style={{ borderColor: 'var(--color-slate-700)' }}
                        >
                          <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          </svg>
                          Connect Google Account
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl space-y-3.5 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200/50'}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-slate-400" />
                        <p className="text-[11px] font-bold text-slate-400">Manual Bypass Token</p>
                      </div>
                      <p className="text-[9px] text-slate-400">
                        Input a raw OAuth access token directly. Perfect for fast testing from the Google OAuth playground. No credentials saved.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="password"
                        placeholder="Paste Google OAuth Access Token..."
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        className={`block w-full px-3 py-1.75 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 border ${
                          isDark ? 'bg-slate-950 border-slate-800 text-slate-250' : 'bg-white border-slate-250 text-slate-900'
                        }`}
                      />
                      <button
                        onClick={handleApplyManualToken}
                        className={`w-full py-1.5 text-[10px] font-bold uppercase tracking-wider text-white rounded-lg hover:brightness-110 shadow-sm transition-all cursor-pointer ${activeTheme.primaryBg}`}
                      >
                        Register Manual Token
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Workspace Active Tab Target View Area */}
              <div className="lg:col-span-7 space-y-4">
                {workspaceActiveTab === 'sheets' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
                      Google Sheets Integration Control
                    </label>

                    <div className={`p-4 rounded-2xl space-y-4 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200/50'}`}>
                      {/* Target input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 block">
                          Google Spreadsheet URL or ID
                        </label>
                        <input
                          type="text"
                          placeholder="Paste e.g. https://docs.google.com/spreadsheets/d/SpreadsheetID/edit"
                          value={spreadsheetIdOrUrl}
                          onChange={(e) => setSpreadsheetIdOrUrl(e.target.value)}
                          className={`block w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${
                            isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>

                      {/* Sync Action Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-1.5">
                        <button
                          onClick={handleImportFromSheet}
                          disabled={isSheetsLoading || (!sheetsAccessToken && !manualToken.trim())}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50/5 cursor-pointer transition-colors disabled:opacity-40"
                          style={{ borderColor: 'var(--color-slate-700)' }}
                          title="Load patient dossiers into EHR safely"
                        >
                          <Download className="h-3.5 w-3.5 text-blue-400" /> Pull & Merge from Sheet
                        </button>
                        <button
                          onClick={handleSyncToExistingSheet}
                          disabled={isSheetsLoading || (!sheetsAccessToken && !manualToken.trim())}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50/5 cursor-pointer transition-colors disabled:opacity-40"
                          style={{ borderColor: 'var(--color-slate-700)' }}
                          title="Overwrite specified document with local cohort list"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isSheetsLoading ? 'animate-spin' : ''}`} /> Push & Sync to Sheet
                        </button>
                      </div>

                      {/* Google Drive Spreadsheet Explorer */}
                      <div className="border-t pt-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Cloud className="h-4 w-4 text-sky-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest block text-slate-400">
                              📂 Launch EHR Portal from GDrive Spreadsheets
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFetchDriveFiles()}
                            disabled={isDriveFetching}
                            className="text-[9px] font-semibold text-sky-400 hover:text-sky-350 flex items-center gap-1 cursor-pointer disabled:opacity-45"
                          >
                            <RefreshCw className={`h-3 w-3 ${isDriveFetching ? 'animate-spin' : ''}`} /> Scan Drive
                          </button>
                        </div>

                        {driveError ? (
                          <p className="text-[10px] text-slate-500 italic px-1">{driveError}</p>
                        ) : driveFiles.length > 0 ? (
                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 border border-slate-800/40 rounded-xl p-2 bg-slate-900/30">
                            {driveFiles.map((file) => {
                              const isActive = spreadsheetIdOrUrl.includes(file.id);
                              return (
                                <div
                                  key={file.id}
                                  className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
                                    isActive 
                                      ? 'bg-sky-500/10 border border-sky-500/35 text-sky-200' 
                                      : 'hover:bg-slate-800/40 text-slate-300'
                                  }`}
                                >
                                  <div className="min-w-0 pr-2">
                                    <p className="font-bold truncate text-[11.5px]">{file.title}</p>
                                    <p className="text-[9px] font-mono text-slate-500 truncate">ID: {file.id}</p>
                                  </div>
                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 hover:text-sky-400 text-slate-400 transition-colors"
                                      title="View on Google Drive"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleLaunchFromDriveSheet(file.id, file.title, file.url)}
                                      className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md cursor-pointer transition-colors ${
                                        isActive 
                                          ? 'bg-emerald-600 text-white brightness-110' 
                                          : 'bg-slate-805 text-slate-300 hover:bg-slate-705'
                                      }`}
                                    >
                                      {isActive ? 'Active Connected' : '🚀 Launch'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-445 italic px-1">Connect your account to scan and launch via Google Drive files.</p>
                        )}
                      </div>

                      {/* Auto generation hero banner */}
                      <div className="border-t pt-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 align-middle">
                          <Sparkles className="h-4 w-4 text-emerald-500" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold">Standardized Workspace Exports</p>
                            <p className="text-[9px] text-slate-400">Instantly export general patient ledgers or compile outcomes reporting sheets.</p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={handleCreateAndExportSheet}
                            disabled={isSheetsLoading || (!sheetsAccessToken && !manualToken.trim())}
                            className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-40`}
                          >
                            Create standard sheet
                          </button>
                          <button
                            onClick={handleCreateAndExportOutcomeReport}
                            disabled={isSheetsLoading || (!sheetsAccessToken && !manualToken.trim())}
                            className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-40`}
                          >
                            Outcomes report
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {workspaceActiveTab === 'drive' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
                      Google Drive Secure Redundant Backup
                    </label>

                    <div className={`p-4 rounded-2xl space-y-4 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200/50'}`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-200">Snapshot Clinical Safe Ledger</p>
                          <p className="text-[9px] text-slate-400 leading-relaxed mt-0.5">
                            Write a secure JSON export containing a fully cryptographically sealed ledger archive directly into your Cloud storage.
                          </p>
                        </div>
                        <button
                          onClick={handleBackupDatabaseToDrive}
                          disabled={isSheetsLoading || (!sheetsAccessToken && !manualToken.trim())}
                          className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl shrink-0 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          <Cloud className="h-3.5 w-3.5" /> Snapshot Ledger
                        </button>
                      </div>

                      <div className="border-t pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            📁 Redundant Backup Archives
                          </p>
                          <button
                            type="button"
                            onClick={() => handleFetchBackupFiles()}
                            disabled={isDriveBackupsLoading || (!sheetsAccessToken && !manualToken.trim())}
                            className="text-[9px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                          >
                            <RefreshCw className={`h-3 w-3 ${isDriveBackupsLoading ? 'animate-spin' : ''}`} /> Scan Backups
                          </button>
                        </div>

                        {isDriveBackupsLoading ? (
                          <p className="text-[10px] text-slate-450 italic">Scanning files for valid backups...</p>
                        ) : driveBackups.length > 0 ? (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {driveBackups.map((archive) => (
                              <div
                                key={archive.id}
                                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/40 bg-slate-950/20 text-xs hover:bg-slate-900/30 transition-all"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-extrabold text-slate-250 truncate text-[11px]">{archive.title}</p>
                                  <p className="text-[9px] font-mono text-slate-500 truncate mt-0.5">
                                    ID: {archive.id.slice(0, 16)}... • Size: {(archive.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreDatabaseFromDrive(archive.id, archive.title)}
                                  disabled={isSheetsLoading}
                                  className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-550/30 rounded-lg cursor-pointer disabled:opacity-40 transition-colors shrink-0"
                                >
                                  Deploy & Restore
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">No compatible database snapshot files discovered in Drive container.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {workspaceActiveTab === 'docs' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
                      Google Docs Narrative Summaries
                    </label>

                    <div className={`p-4 rounded-2xl space-y-4 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200/50'}`}>
                      <div className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-900/30 text-xs">
                        <p className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                          📝 Transcribe Clinical Progression History
                        </p>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Format patient chronicles elegantly with standard healthcare headers, patient vitals, diagnosis indicators, intake sheets, and follow-up clinical timelines directly into Google Documents.
                        </p>
                      </div>

                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {patients.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-850 bg-slate-950/20 hover:bg-slate-900/30 text-xs transition-all"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-slate-205">{p.name}</p>
                              <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
                                Diagnosis: {p.diagnosis || 'None'} • Progress: {p.improvement || 'Stable'}
                              </p>
                            </div>
                            <div className="shrink-0 font-mono">
                              {docExportUrl[p.id] ? (
                                <a
                                  href={docExportUrl[p.id]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-sky-400/30 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 inline-flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> View Doc
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleExportToDoc(p)}
                                  disabled={isDocExporting[p.id] || isSheetsLoading || (!sheetsAccessToken && !manualToken.trim())}
                                  className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer disabled:opacity-40 transition-all inline-flex items-center gap-1"
                                >
                                  {isDocExporting[p.id] ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 animate-spin" /> Publishing...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3 w-3 text-sky-400" /> Print to Doc
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Created Sheets History log (Only displayed if Sheets tab holds active created history) */}
            {workspaceActiveTab === 'sheets' && createdSheetsList.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
                  Recently Synced Cohorts in Google Drive
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {createdSheetsList.map((sheet, index) => (
                    <a
                      key={index}
                      href={sheet.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={`p-2.5 border rounded-xl flex items-center justify-between hover:border-emerald-500/50 transition-colors ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-[11px] font-semibold truncate text-slate-200">{sheet.title}</p>
                        <p className="text-[9px] text-slate-500 font-mono">ID: {sheet.id.slice(0, 8)}...</p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0 hover:text-emerald-500" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Event Info / Error Display Banner */}
            {sheetsStatus.type !== 'idle' && (
              <div className={`p-4 rounded-xl flex items-start gap-2 border text-xs font-semibold ${
                sheetsStatus.type === 'success' 
                  ? 'bg-emerald-100/10 border-emerald-900/30 text-emerald-400' 
                  : sheetsStatus.type === 'error' 
                  ? 'bg-rose-100/10 border-rose-900/30 text-rose-400' 
                  : 'bg-blue-100/10 border-blue-900/30 text-blue-400'
              }`}>
                {isSheetsLoading && sheetsStatus.type === 'loading' ? (
                  <RefreshCw className="h-4 w-4 animate-spin shrink-0 mt-0.5" />
                ) : sheetsStatus.type === 'success' ? (
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 mt-2" />
                ) : (
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">
                    {sheetsStatus.type === 'success' ? 'Google Cloud Sync Success' : sheetsStatus.type === 'error' ? 'Sync Request Terminated' : 'Cloud Request Processing'}
                  </p>
                  <p className="text-[10px] opacity-90 mt-0.5">{sheetsStatus.message}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Controls row */}
        {searchExpanded && (
          <div className="space-y-4 animate-fade-in pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              {/* Query input */}
              <div className="col-span-12 md:col-span-8 relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search by name, condition, last session date, code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`block w-full pl-10 pr-3.5 py-3 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-indigo-500' 
                      : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                  }`}
                />
              </div>

              {/* Sort filter */}
              <div className="col-span-12 md:col-span-4 flex items-center gap-1.5 w-full">
                <div className="relative flex-1 text-xs">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'sessionNo' | 'updated')}
                    className={`block w-full pl-8 pr-3.5 py-3 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-250 bg-slate-950 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 bg-white focus:border-indigo-500'
                    }`}
                    title="Sort patient ledger"
                  >
                    <option value="date">Date of Admission</option>
                    <option value="name">Alphabetical Name</option>
                    <option value="updated">Most Recently Updated</option>
                    <option value="sessionNo">Session No.</option>
                  </select>
                </div>
                <button
                  id="sort_order_toggle_btn"
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className={`p-3 border rounded-xl transition-all cursor-pointer hover:border-indigo-500 hover:text-indigo-500 flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                  title={sortOrder === 'asc' ? 'Ascending Order' : 'Descending Order'}
                >
                  {sortOrder === 'asc' ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Diagnosis filter */}
              <div className="col-span-12 sm:col-span-6 md:col-span-3">
                <select
                  value={filterDiagnosis}
                  onChange={(e) => setFilterDiagnosis(e.target.value)}
                  className={`block w-full px-3.5 py-3 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-slate-250 bg-slate-950 focus:border-indigo-500' 
                      : 'bg-white border-slate-200 text-slate-900 bg-white focus:border-indigo-500'
                  }`}
                >
                  <option value="All">All diagnoses</option>
                  {settings.diagnoses.map((diag) => (
                    <option key={diag} value={diag}>{diag}</option>
                  ))}
                </select>
              </div>

              {/* Improvement filter */}
              <div className="col-span-12 sm:col-span-6 md:col-span-3">
                <select
                  value={filterImprovement}
                  onChange={(e) => setFilterImprovement(e.target.value)}
                  className={`block w-full px-3.5 py-3 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-slate-250 bg-slate-950 focus:border-indigo-500' 
                      : 'bg-white border-slate-200 text-slate-900 bg-white focus:border-indigo-500'
                  }`}
                >
                  <option value="All">All Progress States</option>
                  <option value="Significantly Improved">Significantly Improved</option>
                  <option value="Improved">Improved</option>
                  <option value="Stable">Stable</option>
                  <option value="Unchanged">Unchanged</option>
                  <option value="Deteriorated">Deteriorated</option>
                </select>
              </div>

              {/* Consultant Filter */}
              <div className="col-span-12 sm:col-span-6 md:col-span-3">
                <select
                  value={filterConsultant}
                  onChange={(e) => setFilterConsultant(e.target.value)}
                  className={`block w-full px-3.5 py-3 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-150 ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-slate-250 bg-slate-950 focus:border-indigo-500' 
                      : 'bg-white border-slate-200 text-slate-900 bg-white focus:border-indigo-500'
                  }`}
                >
                  <option value="All">All Consultants</option>
                  {(settings.consultants || []).map((cons) => (
                    <option key={cons} value={cons}>{cons}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Counter feedback */}
            <div className={`flex items-center justify-between text-[11px] font-medium pt-2.5 border-t uppercase tracking-wider ${
              isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-400'
            }`}>
              <span>
                Showing <strong className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{filteredPatients.length}</strong> of{' '}
                <strong className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{patients.length}</strong> patient records
              </span>
              {(searchTerm || filterDiagnosis !== 'All' || filterImprovement !== 'All' || filterConsultant !== 'All' || filterRoute !== 'All') && (
                <button
                  id="clear_search_btn"
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterDiagnosis('All');
                    setFilterImprovement('All');
                    setFilterConsultant('All');
                    setFilterRoute('All');
                  }}
                  className="text-blue-500 hover:text-blue-400 font-bold uppercase tracking-widest text-[10px] cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Patient Ledger Grid */}
      {filteredPatients.length === 0 ? (
        <div id="empty_search_fallback" className={`rounded-2xl border p-12 text-center max-w-lg mx-auto shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-100'
        }`}>
          <p className="text-sm font-bold uppercase tracking-tight">No Patient Records Matched</p>
          <p className="text-slate-400 text-xs mt-1.5 leading-normal">
            Adjust your query queries or sex/progress filters to retrieve other patients.
          </p>
        </div>
      ) : (
        <motion.div id="patient_cards_grid" className="space-y-4" layout>
          <AnimatePresence mode="popLayout">
            {filteredPatients.map((patient, index) => {
              const isExpanded = expandedPatientId === patient.id;

              return (
                <motion.div
                  key={patient.id}
                  id={`patient_card_${patient.id}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.25) }}
                  layout
                  className={`border rounded-3xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.003] ${
                    isExpanded ? 'border-blue-500 ring-4 ring-blue-500/10' : (isDark ? 'border-slate-800/80 bg-slate-900 hover:border-slate-700/80' : 'bg-white border-slate-100/90 hover:border-slate-200/90')
                  }`}
                >
                {/* Header Summary Tab */}
                <div
                  id={`patient_card_header_${patient.id}`}
                  onClick={() => toggleExpand(patient.id)}
                  className={`px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                    isDark ? 'hover:bg-slate-800/40 bg-slate-900' : 'hover:bg-slate-50/50 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    {/* Dynamic styled gradient initials badge / Avatar */}
                    <div 
                      className={`border font-extrabold shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center text-sm shadow-sm md:mt-0.5 overflow-hidden transition-all duration-300 ${
                        isDark 
                          ? 'bg-gradient-to-tr from-slate-950 to-indigo-950/60 border-slate-800 text-indigo-400' 
                          : 'bg-gradient-to-tr from-indigo-50 to-cyan-50/60 border-indigo-100 text-indigo-600'
                      }`}
                      style={{ width: '50px', height: '50px' }}
                    >
                      {patient.profilePic ? (
                        <img src={patient.profilePic} alt={patient.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-display text-sm tracking-wider">{patient.name.charAt(0)}</span>
                      )}
                    </div>
                    
                    <div className="min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-extrabold truncate text-base leading-snug font-display tracking-tight transition-all duration-200 cursor-pointer hover:text-blue-600 hover:underline ${isDark ? 'text-slate-100 hover:text-indigo-400' : 'text-slate-800'}`}>{patient.name}</h4>
                        <span 
                          className={`font-mono text-[9px] font-black border px-2.5 py-0.5 rounded-full tracking-wider uppercase bg-linear-to-r ${
                            isDark 
                              ? 'from-slate-900 to-indigo-950/40 border-slate-850 text-indigo-300' 
                              : 'from-blue-50/50 to-indigo-50/50 border-blue-200/60 text-indigo-700'
                          }`} 
                          title="Patient Clinical Code"
                          style={{ fontSize: '9px' }}
                        >
                          Code: {patient.code}
                        </span>
                      </div>
                      
                      {/* 1st line: age, sex, contact number */}
                      <div 
                        className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-bold md:!ml-0"
                        style={{
                          marginLeft: '-60px',
                          borderRadius: '90px',
                          borderColor: '#bdd9ff',
                          borderWidth: '0.64px',
                          backgroundColor: '#eef7ff',
                          color: '#1447e6',
                          textAlign: 'center',
                          paddingLeft: '7px',
                          paddingRight: '0px',
                          height: '19.2778px',
                        }}
                      >
                        <span 
                          className="text-slate-500 font-bold"
                          style={{ color: '#1447e6', paddingTop: '0px' }}
                        >Age {patient.age}</span>
                        <span className="text-slate-350 dark:text-slate-700 font-normal">&middot;</span>
                        <span 
                          className="text-slate-500 font-bold"
                          style={{ color: '#1447e6' }}
                        >{patient.sex}</span>
                        <span className="text-slate-350 dark:text-slate-700 font-normal">&middot;</span>
                        <span 
                          className="inline-flex items-center text-slate-500 font-bold font-sans"
                          style={{ color: '#1447e6' }}
                        >
                          <Phone 
                            className="h-3 w-3 mr-1 text-slate-400" 
                            style={{ color: '#01810f' }}
                          /> {patient.phone}
                        </span>
                      </div>
                      
                      {/* 2nd line: diagnosis */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span 
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-wider border md:!ml-0 ${
                            isDark 
                              ? 'bg-blue-950/30 text-blue-300 border-blue-900/40' 
                              : 'bg-blue-50/60 text-blue-700 border-blue-200/50'
                          }`}
                          style={{
                            marginLeft: '-60px',
                            fontSize: '10px',
                            height: '19.7778px',
                            color: '#a30d2e',
                          }}
                        >
                          {patient.diagnosis}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    {/* Improvement Status Tag */}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(patient.improvement)}`}>
                       {patient.improvement}
                    </span>

                    {/* Toggle expand chevron */}
                    <div className={`p-1.5 rounded-xl transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                      {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key={`details_${patient.id}`}
                      id={`patient_details_panel_${patient.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className={`border-t p-6 space-y-6 overflow-hidden ${
                        isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-101 bg-[#FAFCFE]'
                      }`}
                    >
                    {/* Patient Fast Diagnostics & Clinical Actions Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Add/Log Follow-Up Option */}
                        {userRole !== 'user' && (
                          <button
                            type="button"
                            onClick={() => onAddFollowUpClick(patient.id)}
                            className="px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                            style={{ color: '#1447e6', backgroundColor: '#eef7ff', borderColor: '#d1e9ff' }}
                          >
                            <CalendarCheck2 className="h-3.5 w-3.5" style={{ color: '#1447e6' }} />
                            Log Follow-Up
                          </button>
                        )}

                        {/* 2. Edit Profile Option */}
                        {userRole !== 'user' && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(patient)}
                            className="px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                            style={{ color: '#1447e6', backgroundColor: '#eef7ff', borderColor: '#d1e9ff' }}
                          >
                            <FileEdit className="h-3.5 w-3.5" style={{ color: '#1447e6' }} />
                            edit
                          </button>
                        )}

                        {/* 3. Print Option */}
                        <button
                          type="button"
                          onClick={() => setPrintingPatientId(patient.id)}
                          className="px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                          style={{ color: '#1447e6', backgroundColor: '#eef7ff', borderColor: '#d1e9ff' }}
                        >
                          <Printer className="h-3.5 w-3.5" style={{ color: '#1447e6' }} />
                          print
                        </button>

                        {/* 4. Secure Share Option */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setSharingPatientId(prev => prev === patient.id ? null : patient.id)}
                            className="px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                            style={{ color: '#1447e6', backgroundColor: '#eef7ff', borderColor: '#d1e9ff' }}
                          >
                            <Share2 className="h-3.5 w-3.5" style={{ color: '#1447e6' }} />
                            share
                          </button>
                          
                          <AnimatePresence>
                            {sharingPatientId === patient.id && (
                              <motion.div
                                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                                className={`absolute right-0 top-full mt-2 w-56 rounded-2xl border p-2 shadow-xl z-20 ${
                                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-150'
                                }`}
                              >
                                <div className="px-2.5 py-1.5 border-b dark:border-slate-800 border-slate-100 mb-1.5">
                                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Secure Channels</p>
                                  <p className="text-[8px] text-slate-450 mt-0.5">Encrypts record detail payload</p>
                                </div>
                                
                                {/* Share as PDF option */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPrintingPatientId(patient.id);
                                    setSharingPatientId(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                                  Share PDF
                                </button>

                                {/* WhatsApp Share */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleShareSocial('whatsapp', patient, false);
                                    setSharingPatientId(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <span className="text-[11px] font-mono font-bold text-emerald-500 w-3.5 text-center">W</span>
                                  Share via WhatsApp
                                </button>

                                {/* Telegram Share */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleShareSocial('telegram', patient, false);
                                    setSharingPatientId(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <span className="text-[11px] font-mono font-bold text-sky-400 w-3.5 text-center">T</span>
                                  Share via Telegram
                                </button>

                                {/* Email Share */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleShareSocial('email', patient, false);
                                    setSharingPatientId(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <Mail className="h-3.5 w-3.5 text-rose-500" />
                                  Email Secure Report
                                </button>

                                {/* Export to Google Docs */}
                                {docExportUrl[patient.id] ? (
                                  <a
                                    key={`doc_view_${patient.id}`}
                                    href={docExportUrl[patient.id]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 cursor-pointer bg-sky-500/10 text-sky-450 hover:bg-sky-500/15"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 text-sky-400" />
                                    View Google Doc
                                  </a>
                                ) : (
                                  <button
                                    key={`doc_export_${patient.id}`}
                                    type="button"
                                    onClick={() => handleExportToDoc(patient)}
                                    disabled={isDocExporting[patient.id]}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 cursor-pointer hover:bg-slate-900 text-slate-350 disabled:opacity-40"
                                  >
                                    <Sparkles className={`h-3.5 w-3.5 text-sky-400 ${isDocExporting[patient.id] ? 'animate-spin' : ''}`} />
                                    {isDocExporting[patient.id] ? 'Exporting...' : 'Export to Google Doc'}
                                  </button>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* 5. Delete Patient Option */}
                        {userRole !== 'user' && (
                          <button
                            type="button"
                            id={`delete_patient_btn_${patient.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePatient(patient.id);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/10 ${
                              isDark 
                                ? 'text-rose-400 bg-rose-950/20 border-rose-900/50 hover:text-rose-300' 
                                : 'text-rose-600 bg-rose-50 border-rose-200 hover:text-rose-700'
                            }`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Profile
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Primary Admission & Clinical Profile Info Panel */}
                    <div className={`p-5 rounded-2xl border ${
                      isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-150 shadow-xs'
                    }`}>
                      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-dashed dark:border-slate-800 border-slate-100">
                        <FileText className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
                        <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Primary Admission & Clinical Profile</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Column 1: Core Patient Specs */}
                        <div className="space-y-3.5">
                          <div>
                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Attending Specialist & Consultant</span>
                            <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? 'text-slate-250' : 'text-slate-800'}`}>
                              <User className="h-4 w-4 text-indigo-400" />
                              <span>{patient.consultant || 'N/A'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date of Admission</span>
                              <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? 'text-slate-250' : 'text-slate-800'}`}>
                                <Calendar className="h-4 w-4 text-emerald-555" />
                                <span>{patient.date ? formatDateToDDMMYYYY(patient.date) : 'N/A'}</span>
                              </div>
                            </div>
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Session Numbers</span>
                              <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? 'text-slate-250' : 'text-slate-800'}`}>
                                <Activity className="h-4 w-4 text-indigo-400" />
                                <span>{patient.treatmentSessions?.length || patient.sessionNo || 1} Session(s)</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Initial Primary Diagnosis</span>
                            <div className="text-xs font-semibold text-slate-500 mt-1">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[9.5px] font-bold border ${
                                isDark 
                                  ? 'bg-blue-955/40 text-blue-300 border-blue-900/50' 
                                  : 'bg-blue-50/60 text-blue-800 border-blue-200/50'
                              }`}>
                                {patient.diagnosis || 'No diagnosis specified'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Column 2: Initial Regimen Details */}
                        <div className="space-y-3.5">
                          <div>
                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Initial Target Treatment / Protocol</span>
                            <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? 'text-slate-250' : 'text-slate-800'}`}>
                              <Layers className="h-4 w-4 text-blue-500" />
                              <span>{patient.treatment || 'N/A'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Route of Administration</span>
                              <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? 'text-slate-250' : 'text-slate-800'}`}>
                                <Shuffle className="h-4 w-4 text-purple-450" />
                                <span className="truncate">{patient.route || 'N/A'}</span>
                              </div>
                            </div>
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{settings.labelProcedurePlace || 'Procedure Place'}</span>
                              <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? 'text-slate-250' : 'text-slate-800'}`}>
                                <Compass className="h-4 w-4 text-emerald-500" />
                                <span className="truncate">{patient.procedurePlace || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {patient.submittedBy && (
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Record Registry Log</span>
                              <div className={`text-[10px] font-semibold text-slate-400 flex items-center gap-1.5 flex-wrap`}>
                                <span>Enrolled: <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                                  {dbUsers[patient.submittedBy.toLowerCase().trim()]?.fullName || patient.submittedBy}
                                </strong></span>
                                {patient.lastEditedBy && (
                                  <>
                                    <span className="text-slate-300 dark:text-slate-700">&middot;</span>
                                    <span>Last edited: <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                                      {dbUsers[patient.lastEditedBy.toLowerCase().trim()]?.fullName || patient.lastEditedBy}
                                    </strong></span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notes Box, if notes specified */}
                      {patient.notes && (
                        <div className={`mt-4 p-3.5 rounded-xl border text-xs leading-relaxed ${
                          isDark 
                            ? 'bg-slate-950/60 border-slate-800/80 text-slate-350' 
                            : 'bg-slate-50/70 border-slate-100 text-slate-600 shadow-inner'
                        }`}>
                          <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span>Initial Admission Clinical Notes & Directives</span>
                          </div>
                          <p className="whitespace-pre-line font-medium">{patient.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Follow-up Submissions Timeline */}
                    <div className="space-y-4 pt-1">
                      {/* Segmented Control Tab Switcher */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2.5 dark:border-slate-800 border-slate-100">
                        <div className="flex items-center flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedTabs = { ...patientTabs, [patient.id]: 'followups' as const };
                              setPatientTabs(updatedTabs);
                            }}
                            className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                              (patientTabs[patient.id] || 'followups') === 'followups'
                                ? (isDark ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' : 'bg-blue-50 text-blue-700 border border-blue-200/50')
                                : 'text-slate-400 hover:text-slate-500 border border-transparent'
                            }`}
                          >
                            <CalendarCheck2 className="h-3.5 w-3.5 text-blue-500" /> F/U Progress
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedTabs = { ...patientTabs, [patient.id]: 'sessions' as const };
                              setPatientTabs(updatedTabs);
                            }}
                            className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                              patientTabs[patient.id] === 'sessions'
                                ? (isDark ? 'bg-emerald-900/30 text-emerald-450 border border-emerald-900/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50')
                                : 'text-slate-400 hover:text-slate-500 border border-transparent'
                            }`}
                          >
                            <Activity className="h-3.5 w-3.5 text-emerald-555" /> Session Info
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedTabs = { ...patientTabs, [patient.id]: 'attachments' as const };
                              setPatientTabs(updatedTabs);
                            }}
                            className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                              patientTabs[patient.id] === 'attachments'
                                ? (isDark ? 'bg-orange-900/30 text-orange-400 border border-orange-900/50' : 'bg-orange-50 text-orange-755 border border-orange-200/50')
                                : 'text-slate-400 hover:text-slate-50 border border-transparent'
                            }`}
                          >
                            <Paperclip className="h-3.5 w-3.5 text-orange-555" /> Attachments ({(patient.attachments || []).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedTabs = { ...patientTabs, [patient.id]: 'versions' as const };
                              setPatientTabs(updatedTabs);
                            }}
                            className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                              patientTabs[patient.id] === 'versions'
                                ? (isDark ? 'bg-purple-900/30 text-purple-400 border border-purple-900/50' : 'bg-purple-50 text-purple-700 border border-purple-200/50')
                                : 'text-slate-400 hover:text-slate-550 border border-transparent'
                            }`}
                          >
                            <History className="h-3.5 w-3.5 text-purple-500" /> Snapshots ({versions[patient.id]?.length || 0})
                          </button>
                        </div>
                        
                        {(patientTabs[patient.id] || 'followups') === 'followups' ? (
                          <span className={`font-mono text-[10px] border px-2.5 py-0.5 rounded-full font-bold ${
                            isDark ? 'bg-slate-950 border-slate-800 text-slate-350' : 'bg-slate-100 border-slate-200/60 text-slate-500'
                          }`}>
                            {patient.followUps.length} record{patient.followUps.length === 1 ? '' : 's'} registered
                          </span>
                        ) : patientTabs[patient.id] === 'sessions' ? (
                          <span className={`font-mono text-[10px] border px-2.5 py-0.5 rounded-full font-bold ${
                            isDark ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          }`}>
                            {(patient.treatmentSessions || []).length} session{(patient.treatmentSessions || []).length === 1 ? '' : 's'} logged
                          </span>
                        ) : patientTabs[patient.id] === 'versions' ? (
                          <span className={`font-mono text-[10px] border px-2.5 py-0.5 rounded-full font-bold ${
                            isDark ? 'bg-slate-950 border-slate-800 text-purple-400' : 'bg-purple-50 border-purple-100 text-purple-700'
                          }`}>
                            {versions[patient.id]?.length || 0} snapshot{versions[patient.id]?.length === 1 ? '' : 's'} archived
                          </span>
                        ) : (
                          <span className={`font-mono text-[10px] border px-2.5 py-0.5 rounded-full font-bold ${
                            isDark ? 'bg-slate-950 border-slate-800 text-orange-400' : 'bg-orange-50 border-orange-100 text-orange-755'
                          }`}>
                            {(patient.attachments || []).length} file{(patient.attachments || []).length === 1 ? '' : 's'} attached
                          </span>
                        )}
                      </div>

                      {/* CONDITIONAL RENDERING OF CONTENT */}
                      {(patientTabs[patient.id] || 'followups') === 'followups' ? (
                        /* FOLLOW-UP LOG CONTENT */
                        <>
                          {patient.followUps.length === 0 ? (
                            <div id="no_followups_timeline_fallback" className={`border border-dashed rounded-2xl p-6 text-center text-xs text-slate-400 max-w-sm mx-auto shadow-sm ${
                              isDark ? 'bg-slate-950 border-slate-800' : 'bg-[#FFFFFF] border-slate-202'
                            }`}>
                              No intermediate follow-up consultations logged. Click "Log Follow-Up" on the right to start documenting progression.
                            </div>
                          ) : (
                            <div id="followup_timeline_list" className={`relative pl-6 space-y-4 border-l-2 ml-4 pt-2 ${
                              isDark ? 'border-slate-800' : 'border-slate-100'
                            }`}>
                              {patient.followUps.map((log) => (
                                <div key={log.id} className="relative group">
                                  {/* Sleek round node */}
                                  <span className="absolute -left-9.5 top-1.5 bg-blue-500 border-[3px] border-white h-4 w-4 rounded-full shadow-sm group-hover:scale-110 transition-transform dark:border-slate-950"></span>

                                  <div className={`border rounded-2xl p-4.5 shadow-sm transition-colors ${
                                    isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-slate-203'
                                  }`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 uppercase ${
                                          isDark ? 'bg-slate-955 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200/50 text-slate-550'
                                        }`}>
                                          <Calendar className="h-3.5 w-3.5 text-slate-400" /> {formatDateToDDMMYYYY(log.date)}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                          isDark ? 'bg-slate-950 text-blue-300 border border-blue-900' : 'bg-blue-50/60 text-blue-800'
                                        }`}>
                                          {log.status}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <User className="h-3 w-3 text-slate-400 mr-0.5" /> Dr. {log.clinician}
                                      </span>
                                    </div>

                                    <p className={`text-xs leading-relaxed font-normal ${isDark ? 'text-slate-300' : 'text-slate-650'}`}>{log.notes}</p>

                                    {log.attachments && log.attachments.length > 0 && (
                                      <div className="mt-4 pt-3 border-t border-slate-101/30 dark:border-slate-800/80 space-y-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                          <Paperclip className={`h-3 w-3 ${activeTheme.primaryText}`} /> Follow-Up Attachments Gallery ({log.attachments.length})
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                                          {log.attachments.map((file) => {
                                            const isImage = file.type.startsWith('image/');
                                            const textPreview = getTextPreview(file);
                                            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                                            
                                            return (
                                              <div 
                                                key={file.id} 
                                                onClick={() => {
                                                  setPreviewAttachment(file);
                                                  setPreviewZoom(1);
                                                  setPreviewRotation(0);
                                                }}
                                                className={`group relative rounded-2xl border p-2.5 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none h-28 hover:scale-[1.02] hover:-translate-y-0.5 ${
                                                  isDark 
                                                    ? 'bg-slate-950 hover:bg-slate-900 border-slate-800/80 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-950/10' 
                                                    : 'bg-white hover:bg-slate-50 border-slate-200/50 hover:border-blue-500/30 hover:shadow-md'
                                                }`}
                                              >
                                                {isImage ? (
                                                  <div className="absolute inset-0 rounded-2xl overflow-hidden">
                                                    <img src={file.data} alt={file.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-slate-950/10 opacity-80 group-hover:opacity-95 transition-opacity" />
                                                    <div className="absolute inset-0 flex flex-col justify-between p-2 text-white">
                                                      <div className="flex items-center justify-between">
                                                        <span className="px-1.5 py-0.5 rounded bg-black/40 text-[7.5px] font-mono uppercase tracking-wider font-extrabold backdrop-blur-xs">IMG</span>
                                                        <span className="text-[8px] text-slate-300 font-mono font-medium">{(file.size / 1024).toFixed(0)} KB</span>
                                                      </div>
                                                      <div className="space-y-0.5">
                                                        <p className="text-[9.5px] font-bold line-clamp-1 text-slate-100" title={file.name}>{file.name}</p>
                                                        <span className="text-[7.5px] text-slate-350 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                          <Eye className="h-2.5 w-2.5 text-blue-400" /> Preview
                                                        </span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : textPreview ? (
                                                  <>
                                                    <div className="space-y-1 flex-1 min-w-0">
                                                      <div className="flex items-center justify-between">
                                                        <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono uppercase font-black tracking-wider ${
                                                          isDark ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-amber-100 text-amber-800 border border-amber-200/50'
                                                        }`}>REPORT</span>
                                                        <span className="text-[8px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                                                      </div>
                                                      <p className={`text-[9.5px] font-bold line-clamp-1 mt-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={file.name}>{file.name}</p>
                                                      <div className={`rounded-lg p-1.5 select-none font-mono text-[8.5px] line-clamp-2 leading-relaxed tracking-tight break-all border mt-1 ${
                                                        isDark ? 'bg-slate-900 border-slate-800/60 text-slate-400' : 'bg-slate-50 border-slate-150 text-slate-600'
                                                      }`}>
                                                        {textPreview}
                                                      </div>
                                                    </div>
                                                    <div className="pt-1.5 flex items-center justify-between mt-auto border-t border-slate-100/10" onClick={(e) => e.stopPropagation()}>
                                                      <span className="text-[8px] text-slate-400 font-semibold flex items-center gap-0.5 hover:text-amber-500 cursor-pointer" onClick={() => {
                                                        setPreviewAttachment(file);
                                                        setPreviewZoom(1);
                                                        setPreviewRotation(0);
                                                      }}>
                                                        <Eye className="h-2.5 w-2.5 text-amber-500" /> View Notes
                                                      </span>
                                                      <button onClick={() => handleDownloadAttachment(file)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40" title="Download">
                                                        <Download className="h-2.5 w-2.5" />
                                                      </button>
                                                    </div>
                                                  </>
                                                ) : isPdf ? (
                                                  <>
                                                    <div className="space-y-1 flex-1 min-w-0">
                                                      <div className="flex items-center justify-between">
                                                        <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase tracking-wider ${
                                                          isDark ? 'bg-rose-450/10 text-rose-400 border border-rose-450/20' : 'bg-rose-100 text-rose-800 border border-rose-200/50'
                                                        }`}>PDF FILE</span>
                                                        <span className="text-[8px] text-slate-400 font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                                                      </div>
                                                      <p className={`text-[9.5px] font-bold line-clamp-2 mt-1 ${isDark ? 'text-slate-200' : 'text-slate-200'}`} title={file.name}>{file.name}</p>
                                                    </div>
                                                    <div className="pt-1.5 flex items-center justify-between mt-auto border-t border-slate-100/10" onClick={(e) => e.stopPropagation()}>
                                                      <span className="text-[8px] text-slate-400 font-semibold flex items-center gap-0.5 hover:text-rose-500 cursor-pointer" onClick={() => {
                                                        setPreviewAttachment(file);
                                                        setPreviewZoom(1);
                                                        setPreviewRotation(0);
                                                      }}>
                                                        <Eye className="h-2.5 w-2.5 text-rose-500" /> Live Preview
                                                      </span>
                                                      <button onClick={() => handleDownloadAttachment(file)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40" title="Download">
                                                        <Download className="h-2.5 w-2.5" />
                                                      </button>
                                                    </div>
                                                  </>
                                                ) : (
                                                  <>
                                                    <div className="space-y-1 flex-1 min-w-0">
                                                      <div className="flex items-center justify-between">
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[7.5px] font-mono tracking-wider font-extrabold uppercase">
                                                          {file.name.split('.').pop()?.substring(0, 3) || 'doc'}
                                                        </span>
                                                        <span className="text-[8px] text-slate-400 font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                                                      </div>
                                                      <p className={`text-[9.5px] font-bold line-clamp-2 mt-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={file.name}>{file.name}</p>
                                                    </div>
                                                    <div className="pt-1.5 flex items-center justify-between mt-auto border-t border-slate-101/10" onClick={(e) => e.stopPropagation()}>
                                                      <span className="text-[8px] text-slate-400 font-semibold flex items-center gap-0.5 hover:text-blue-500 cursor-pointer" onClick={() => {
                                                        setPreviewAttachment(file);
                                                        setPreviewZoom(1);
                                                        setPreviewRotation(0);
                                                      }}>
                                                        <Eye className="h-2.5 w-2.5 text-blue-500" /> Preview
                                                      </span>
                                                      <button onClick={() => handleDownloadAttachment(file)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40" title="Download">
                                                        <Download className="h-2.5 w-2.5" />
                                                      </button>
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : patientTabs[patient.id] === 'sessions' ? (
                        /* TREATMENT SESSIONS CONTENT */
                        <>
                          {/* INLINE FORM TO LOG NEW TREATMENT SESSION */}
                          {userRole !== 'user' && (
                            showAddSessionId === patient.id ? (
                              <div className={`border rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in ${
                                isDark ? 'bg-slate-900/60 border-emerald-900/50' : 'bg-emerald-50/20 border-emerald-200/55'
                              }`}>
                                <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800 border-slate-200/40">
                                  <span className={`text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 ${
                                    isDark ? 'text-emerald-450' : 'text-emerald-800'
                                  }`}>
                                    <PlusCircle className="h-4 w-4" /> Record Treatment Session #{sessionNo}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowAddSessionId(null)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                    title="Close logging form"
                                  >
                                    <X className="h-4.5 w-4.5" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                  {/* Session Number */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Session Number *</label>
                                    <input
                                      type="number"
                                      value={sessionNo}
                                      onChange={(e) => setSessionNo(Number(e.target.value))}
                                      className={`w-full rounded-xl border p-2.5 font-bold transition-all ${
                                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                      }`}
                                    />
                                  </div>

                                  {/* Date */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Treatment Date *</label>
                                    <input
                                      type="date"
                                      value={sessionDate}
                                      onChange={(e) => setSessionDate(e.target.value)}
                                      className={`w-full rounded-xl border p-2.5 transition-all ${
                                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                                      }`}
                                    />
                                  </div>

                                  {/* Consultant */}
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{labelConsultant} *</label>
                                    <select
                                      value={sessionConsultant}
                                      onChange={(e) => {
                                        setSessionConsultant(e.target.value);
                                        if (e.target.value !== 'Other') {
                                          setSessionConsultantCustom('');
                                        }
                                      }}
                                      className={`w-full rounded-xl border p-2.5 transition-all ${
                                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                                      }`}
                                    >
                                      <option value="">-- Choose attending practitioner --</option>
                                      {settings.consultants.map((con) => (
                                        <option key={con} value={con}>{con}</option>
                                      ))}
                                      <option value="Other">Custom Specialist...</option>
                                    </select>

                                    {sessionConsultant === 'Other' && (
                                      <input
                                        type="text"
                                        placeholder="Specify practitioner name..."
                                        value={sessionConsultantCustom}
                                        onChange={(e) => setSessionConsultantCustom(e.target.value)}
                                        className={`w-full mt-2 rounded-xl border p-2.5 transition-all ${
                                          isDark ? 'bg-slate-950 border-slate-800 text-slate-202' : 'bg-white border-slate-203'
                                        }`}
                                      />
                                    )}
                                  </div>

                                  {/* Treatment protocol */}
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{labelTreatment} *</label>
                                    <select
                                      value={sessionTreatment}
                                      onChange={(e) => {
                                        setSessionTreatment(e.target.value);
                                        if (e.target.value !== 'Other') {
                                          setSessionTreatmentCustom('');
                                        }
                                      }}
                                      className={`w-full rounded-xl border p-2.5 transition-all ${
                                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                                      }`}
                                    >
                                      <option value="">-- Select active cohort protocol --</option>
                                      {(settings.treatments || []).map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                      <option value="Other">Customized Therapeutic...</option>
                                    </select>

                                    {sessionTreatment === 'Other' && (
                                      <input
                                        type="text"
                                        placeholder="Declare custom protocol..."
                                        value={sessionTreatmentCustom}
                                        onChange={(e) => setSessionTreatmentCustom(e.target.value)}
                                        className={`w-full mt-2 rounded-xl border p-2.5 transition-all ${
                                          isDark ? 'bg-slate-950 border-slate-800 text-slate-202' : 'bg-white border-slate-203'
                                        }`}
                                      />
                                    )}
                                  </div>

                                  {/* Route */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{labelRoute} *</label>
                                    <select
                                      value={sessionRoute}
                                      onChange={(e) => {
                                        setSessionRoute(e.target.value);
                                        if (e.target.value !== 'Other') {
                                          setSessionRouteCustom('');
                                        }
                                      }}
                                      className={`w-full rounded-xl border p-2.5 transition-all ${
                                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                                      }`}
                                    >
                                      <option value="">-- Choose administration route --</option>
                                      {settings.routes.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                      <option value="Other">Custom Infusion Pathway...</option>
                                    </select>

                                    {sessionRoute === 'Other' && (
                                      <input
                                        type="text"
                                        placeholder="Enter custom path route..."
                                        value={sessionRouteCustom}
                                        onChange={(e) => setSessionRouteCustom(e.target.value)}
                                        className={`w-full mt-2 rounded-xl border p-2.5 transition-all ${
                                          isDark ? 'bg-slate-950 border-slate-800 text-slate-202' : 'bg-white border-slate-203'
                                        }`}
                                      />
                                    )}
                                  </div>

                                  {/* Amount */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{labelAmount} *</label>
                                    <input
                                      type="text"
                                      value={sessionAmount}
                                      onChange={(e) => setSessionAmount(e.target.value)}
                                      placeholder="e.g. 5 mL, 1.5M Units"
                                      className={`w-full rounded-xl border p-2.5 transition-all ${
                                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                                      }`}
                                    />
                                  </div>

                                  {/* Procedure Place */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{settings.labelProcedurePlace || 'Procedure Place'}</label>
                                    <select
                                      value={sessionProcedurePlace}
                                      onChange={(e) => {
                                        setSessionProcedurePlace(e.target.value);
                                        if (e.target.value !== 'Other') {
                                          setSessionProcedurePlaceCustom('');
                                        }
                                      }}
                                      className={`w-full rounded-xl border p-2.5 transition-all ${
                                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                                      }`}
                                    >
                                      <option value="">-- Choose procedure place --</option>
                                      {(settings.procedurePlaces || ['Operating Room A', 'Operating Room B', 'OPD Room C', 'Clinic Room 1']).map((room) => (
                                        <option key={room} value={room}>{room}</option>
                                      ))}
                                      <option value="Other">Custom Location...</option>
                                    </select>

                                    {sessionProcedurePlace === 'Other' && (
                                      <input
                                        type="text"
                                        placeholder="Specify procedure place..."
                                        value={sessionProcedurePlaceCustom}
                                        onChange={(e) => setSessionProcedurePlaceCustom(e.target.value)}
                                        className={`w-full mt-2 rounded-xl border p-2.5 transition-all ${
                                          isDark ? 'bg-slate-950 border-slate-800 text-slate-202' : 'bg-white border-slate-203'
                                        }`}
                                      />
                                    )}
                                  </div>

                                  {/* Notes */}
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Session Remarks & Notes</label>
                                    <textarea
                                      value={sessionNotes}
                                      onChange={(e) => setSessionNotes(e.target.value)}
                                      rows={2}
                                      placeholder="Add notes specific to this therapeutic infusion/injection session..."
                                      className={`w-full rounded-xl border p-2.5 transition-all ${
                                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'
                                      }`}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800 border-slate-200/50">
                                  <button
                                    type="button"
                                    onClick={() => setShowAddSessionId(null)}
                                    className={`px-4 py-2 text-xs font-bold uppercase rounded-xl border cursor-pointer ${
                                      isDark ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveTreatmentSession(patient.id)}
                                    className={`px-4 py-2 text-xs font-extrabold uppercase rounded-xl text-white bg-emerald-600 hover:bg-emerald-750 shadow-sm cursor-pointer`}
                                  >
                                    Save Session
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-start">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddSession(patient)}
                                  className={`text-[10px] font-bold uppercase tracking-wider py-2 px-3.5 rounded-xl border border-dashed transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isDark ? 'bg-emerald-950/10 border-emerald-900/50 text-emerald-450 hover:bg-emerald-950/30' : 'bg-emerald-50/20 border-emerald-202 text-emerald-700 hover:bg-emerald-50/50'
                                  }`}
                                >
                                  <PlusCircle className="h-4 w-4" /> Record Treatment Session
                                </button>
                              </div>
                            )
                          )}

                          {/* LIST OF REGISTERED SESSIONS */}
                          {(!patient.treatmentSessions || patient.treatmentSessions.length === 0) ? (
                            <div id="no_treatment_sessions_fallback" className={`border border-dashed rounded-2xl p-6 text-center text-xs text-slate-400 max-w-sm mx-auto shadow-sm ${
                              isDark ? 'bg-slate-950 border-slate-800' : 'bg-[#FFFFFF] border-slate-202'
                            }`}>
                              No additional treatments logged. Click "Record Treatment Session" to construct a medical chronology of cell administrations.
                            </div>
                          ) : (
                            <div id="treatment_sessions_list" className={`relative pl-6 space-y-4 border-l-2 ml-4 pt-2 border-emerald-500/20`}>
                              {patient.treatmentSessions.map((session) => (
                                <div key={session.id} className="relative group/sess">
                                  {/* Sleek emerald node */}
                                  <span className="absolute -left-9.5 top-1.5 bg-emerald-500 border-[3px] border-white h-4 w-4 rounded-full shadow-sm group-hover/sess:scale-110 transition-transform dark:border-slate-900"></span>

                                  <div className={`border rounded-2xl p-4.5 shadow-sm transition-colors ${
                                    isDark ? 'bg-slate-900 border-slate-850 hover:border-slate-800' : 'bg-white border-slate-100 hover:border-slate-180'
                                  }`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 uppercase ${
                                          isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-emerald-50/30 border-emerald-100 text-emerald-800'
                                        }`}>
                                          Session #{session.sessionNo}
                                        </span>
                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 uppercase ${
                                          isDark ? 'bg-slate-955 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-202 text-slate-550'
                                        }`}>
                                          <Calendar className="h-3.5 w-3.5" /> {formatDateToDDMMYYYY(session.date)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2.5">
                                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                          <User className="h-3 w-3 mr-0.5 text-slate-400" /> {session.consultant}
                                        </span>
                                        {userRole !== 'user' && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTreatmentSession(patient.id, session.id)}
                                            className={`p-1 rounded opacity-0 group-hover/sess:opacity-100 focus:opacity-100 transition-opacity cursor-pointer ${
                                              isDark ? 'text-slate-500 hover:text-rose-450 hover:bg-slate-800' : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                                            }`}
                                            title="Delete this session record"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-2 text-slate-500 dark:text-slate-400">
                                      <div>
                                        <strong className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Protocol:</strong>
                                        <span className={`text-[11px] font-medium ${isDark ? 'text-slate-350' : 'text-slate-700'}`}>{session.treatment}</span>
                                      </div>
                                      <div>
                                        <strong className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Dose & Route:</strong>
                                        <span className={`text-[11px] font-medium ${isDark ? 'text-slate-350' : 'text-slate-700'}`}>{session.amount} &middot; <span className="text-slate-400 text-[10px] font-normal">{session.route}</span></span>
                                      </div>
                                      <div>
                                        <strong className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">{settings.labelProcedurePlace || 'Procedure Place'}:</strong>
                                        <span className={`text-[11px] font-medium ${isDark ? 'text-slate-350' : 'text-slate-700'}`}>{session.procedurePlace || 'N/A'}</span>
                                      </div>
                                    </div>

                                    {session.notes && (
                                      <div className={`mt-2 p-2.5 rounded-lg text-xs leading-relaxed font-normal border ${
                                        isDark ? 'bg-slate-950/50 border-slate-850 text-slate-355' : 'bg-slate-50/50 border-slate-150/50 text-slate-600'
                                      }`}>
                                        {session.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : patientTabs[patient.id] === 'versions' ? (
                        /* SECURED DOSSIER SNAPSHOT TIMELINE CONTROL */
                        <div className="space-y-4 pt-1 animate-fade-in font-sans">
                          <div className={`p-5 rounded-2xl border ${
                            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center gap-2 border-b pb-3 mb-4 dark:border-slate-800 border-slate-200/60">
                              <History className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
                              <div>
                                <h4 className={`text-[11px] font-extrabold uppercase tracking-widest ${isDark ? 'text-slate-250' : 'text-slate-705'}`}>
                                  Cryptographic EHR Diagnostic Snapshots
                                </h4>
                                <p className="text-[10px] text-slate-450 mt-0.5">View and restore historical version signatures for this patient dossier.</p>
                              </div>
                            </div>

                            {versionsLoading[patient.id] ? (
                              <div className="flex items-center justify-center p-8 gap-2 text-xs text-slate-400">
                                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                                <span>Decrypting secure timeline archives...</span>
                              </div>
                            ) : (!versions[patient.id] || versions[patient.id].length === 0) ? (
                              <div className="text-center py-6 text-slate-450 text-xs italic">
                                No historical alterations recorded. This dossier represents the initial base state.
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                {versions[patient.id].map((ver, idx) => {
                                  const isCurrent = idx === 0; // The latest version is first from server array list
                                  return (
                                    <div 
                                      key={ver.id}
                                      className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                                        isDark 
                                          ? (isCurrent ? 'bg-slate-950/40 border-purple-900/40' : 'bg-slate-900/10 border-slate-800 hover:bg-slate-900/30') 
                                          : (isCurrent ? 'bg-purple-100/15 border-purple-250/50' : 'bg-white border-slate-100 hover:bg-slate-50/50')
                                      }`}
                                    >
                                      <div className="space-y-1 text-left">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`text-[9.5px] font-bold px-2 py-0.25 rounded-md ${
                                            isCurrent ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-550/10'
                                          }`}>
                                            v{ver.version}
                                          </span>
                                          <span className="font-mono text-[10px] text-slate-450">
                                            {new Date(ver.timestamp).toLocaleString()}
                                          </span>
                                          {isCurrent && (
                                            <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.25 rounded text-[8.5px] font-bold uppercase border border-emerald-500/15">Active</span>
                                          )}
                                        </div>
                                        <p className={`text-[11.5px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-650'}`}>
                                          Dossier snapshot captured during action <span className="font-mono text-blue-450 uppercase">{ver.action}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                          Authorized Practitioner: <span className="font-mono text-indigo-405">u/{ver.username}</span> &middot; ID: {ver.id.substring(0, 8)}...
                                        </p>
                                      </div>

                                      {!isCurrent && userRole !== 'user' && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const confirmRestore = confirm(`CONFIRM VERSION OVERWRITE:\nAre you sure you want to restore this patient dossier to v${ver.version}?\n\nThis will record a new restoration action in compliance logs.`);
                                            if (!confirmRestore) return;
                                              try {
                                                const res = await fetch(`/api/patients/${patient.id}/versions/${ver.id}/restore`, {
                                                  method: 'POST'
                                                });
                                                if (res.ok) {
                                                  alert(`Patient Dossier Restored Successfully to v${ver.version}! Interface now synchronizing.`);
                                                  window.location.reload();
                                                } else {
                                                  alert("Restore failed. Check system authorization levels.");
                                                }
                                              } catch (err) {
                                                alert("An error occurred during restore endpoint integration.");
                                              }
                                          }}
                                          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/50 hover:bg-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30 dark:hover:bg-purple-900/40 cursor-pointer"
                                        >
                                          <RotateCcw className="h-3.5 w-3.5" /> Restore Snapshot
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* ATTACHMENTS DETAILED TAB PANEL */
                        <div className="space-y-4 pt-1 animate-fade-in">
                          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <h4 className={`text-[11px] font-extrabold uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-705'}`}>
                                  Diagnostic File Attachments ({(patient.attachments || []).length})
                                </h4>
                                <p className="text-[10px] text-slate-450 mt-0.5">Scans, reports, and imaging associated with this patient record.</p>
                              </div>
                              {userRole !== 'user' && (
                                <label
                                  htmlFor={`patient_detail_modal_upload_${patient.id}`}
                                  className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer border ${
                                    isDark
                                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs'
                                  }`}
                                >
                                  <Upload className="h-3.5 w-3.5 text-blue-500" />
                                  Attach Diagnostic File
                                  <input
                                    id={`patient_detail_modal_upload_${patient.id}`}
                                    type="file"
                                    onChange={(e) => handleAttachmentUpload(e, patient.id)}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>

                            {(!patient.attachments || patient.attachments.length === 0) ? (
                              <div className={`border border-dashed rounded-xl p-8 text-center text-xs text-slate-400 max-w-sm mx-auto shadow-sm mt-4 bg-white/50 dark:bg-slate-950/20 ${
                                isDark ? 'border-slate-805' : 'border-slate-200'
                              }`}>
                                <Paperclip className="h-7 w-7 mx-auto text-slate-300 mb-2" />
                                No files attached to this patient record.
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                                {patient.attachments.map((file) => {
                                  const isImage = file.type.startsWith('image/');
                                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                                  return (
                                    <div
                                      key={file.id}
                                      onClick={() => {
                                        setPreviewAttachment(file);
                                        setPreviewZoom(1);
                                        setPreviewRotation(0);
                                      }}
                                      className={`group relative rounded-2xl border p-2.5 flex flex-col justify-between transition-all duration-200 cursor-pointer h-28 hover:scale-[1.02] hover:-translate-y-0.5 ${
                                        isDark
                                          ? 'bg-slate-950 hover:bg-slate-900 border-slate-800/80 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-950/10'
                                          : 'bg-white hover:bg-slate-50 border-slate-200/50 hover:border-blue-505/30 hover:shadow-md'
                                      }`}
                                    >
                                      {isImage ? (
                                        <div className="absolute inset-0 rounded-2xl overflow-hidden">
                                          <img src={file.data} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 opacity-80 group-hover:opacity-95 transition-opacity" />
                                          <div className="absolute inset-0 flex flex-col justify-between p-2 text-white">
                                            <div className="flex items-center justify-between">
                                              <span className="px-1.5 py-0.5 rounded bg-black/40 text-[7.5px] font-mono tracking-wider font-extrabold backdrop-blur-xs">IMG</span>
                                              <span className="text-[8px] font-mono text-slate-300">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                            </div>
                                            <p className="text-[9.5px] font-bold line-clamp-1 text-slate-100" title={file.name}>{file.name}</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="space-y-1 flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                              <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono font-black tracking-wider uppercase ${
                                                isPdf ? 'bg-rose-450/10 text-rose-400 border border-rose-450/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-505'
                                              }`}>
                                                {isPdf ? 'PDF' : file.name.split('.').pop()?.substring(0, 3) || 'doc'}
                                              </span>
                                              <span className="text-[8px] text-slate-400 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                            </div>
                                            <p className={`text-[9.5px] font-bold line-clamp-2 mt-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={file.name}>{file.name}</p>
                                          </div>
                                          <div className="pt-1.5 flex items-center justify-between mt-auto border-t border-slate-101/10" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-[8px] text-slate-400 font-semibold flex items-center gap-0.5 hover:text-blue-500 cursor-pointer">
                                              <Eye className="h-2.5 w-2.5 text-blue-500" /> Preview
                                            </span>
                                            <div className="flex items-center gap-0.5">
                                              <button onClick={() => handleDownloadAttachment(file)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40" title="Download">
                                                <Download className="h-2.5 w-2.5" />
                                              </button>
                                              {userRole !== 'user' && (
                                                <button onClick={() => handleDeleteAttachment(patient.id, file.id)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/40" title="Delete">
                                                  <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  )}

      {printingPatient && (
        <PrintProfileModal
          patient={printingPatient}
          onClose={() => setPrintingPatientId(null)}
          activeTheme={activeTheme}
          settings={settings}
        />
      )}

      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs font-sans animate-fade-in">
          <div className={`w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-205 text-slate-900'
          }`}>
            {/* Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-150 bg-slate-50/50'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                  previewAttachment.type.startsWith('image/') ? 'bg-blue-600' :
                  previewAttachment.type === 'application/pdf' || previewAttachment.name.toLowerCase().endsWith('.pdf') ? 'bg-rose-600' : 'bg-amber-605'
                }`}>
                  <Paperclip className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold truncate pr-3" title={previewAttachment.name}>
                    {previewAttachment.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {(previewAttachment.size / 1024).toFixed(1)} KB &bull; {previewAttachment.type || 'Unknown MIME'} &bull; Uploaded {new Date(previewAttachment.uploadedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Actions / Utilities */}
              <div className="flex items-center gap-2 shrink-0">
                {previewAttachment.type.startsWith('image/') && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(prev => Math.min(prev + 0.25, 3))}
                      className="p-1 px-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/55 transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(prev => Math.max(prev - 0.25, 0.5))}
                      className="p-1 px-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/55 transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                      className="p-1 px-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/55 transition-colors cursor-pointer"
                      title="Rotate Clockwise"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(previewAttachment)}
                  className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] uppercase font-bold tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Download File payload"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
                
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer border ${
                    isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-505'
                  }`}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Viewport Render Area */}
            <div className={`p-6 flex-1 overflow-y-auto flex items-center justify-center ${
              isDark ? 'bg-slate-950/70' : 'bg-slate-50/40'
            }`}>
              {previewAttachment.type.startsWith('image/') ? (
                <div className="w-full h-full relative overflow-hidden flex items-center justify-center rounded-2xl border border-dashed border-slate-805 bg-slate-905">
                  <div 
                    className="transition-transform duration-200 ease-out flex items-center justify-center"
                    style={{ transform: `scale(${previewZoom}) rotate(${previewRotation}deg)` }}
                  >
                    <img 
                      src={previewAttachment.data} 
                      alt={previewAttachment.name} 
                      className="max-h-[50vh] max-w-full object-contain shadow-2xl rounded-lg" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 text-center">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-black/50 backdrop-blur-xs py-1 px-3 rounded-full inline-block">
                      Rotation: {previewRotation}° &bull; Scale: {(previewZoom * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ) : getTextPreview(previewAttachment) ? (
                <div className="w-full h-full flex flex-col space-y-3">
                  <p className="text-[10px] font-bold text-slate-405 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-amber-500" /> Secure Clinical Document Viewport (Self-contained logs)
                  </p>
                  <div className={`flex-1 rounded-2xl p-6 font-mono leading-relaxed text-[11.5px] border shadow-inner whitespace-pre-wrap overflow-y-auto select-text ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-350' : 'bg-[#fffdf6] border-slate-200 text-slate-850'
                  }`}>
                    {getTextPreview(previewAttachment)}
                  </div>
                </div>
              ) : (previewAttachment.type === 'application/pdf' || previewAttachment.name.toLowerCase().endsWith('.pdf')) ? (
                <div className="w-full h-full flex flex-col space-y-3">
                  <p className="text-[10px] font-bold text-slate-405 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-rose-500" /> Interactive Browser PDF Frame (Embedded Viewer)
                  </p>
                  <div className="flex-1 rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 shadow-lg relative bg-slate-900">
                    <iframe 
                      src={previewAttachment.data} 
                      title={previewAttachment.name} 
                      className="w-full h-full border-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 max-w-md">
                  <div className={`h-16 w-16 mx-auto rounded-full flex items-center justify-center ${
                    isDark ? 'bg-slate-900 text-slate-555' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Paperclip className="h-8 w-8" />
                  </div>
                  <div>
                    <h5 className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      No interactive viewer available
                    </h5>
                    <p className="text-[10.5px] text-slate-400 mt-1.5 leading-relaxed">
                      This diagnostic attachment type does not support in-browser visual compilation. However, you can download the file payload securely to open it with local applications.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment(previewAttachment)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="h-4 w-4" /> Download Original File
                  </button>
                </div>
              )}
            </div>

            {/* Footer status indicator */}
            <div className={`px-6 py-3 border-t text-[10px] text-slate-500 font-mono flex items-center justify-between shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-950/20' : 'border-slate-150 bg-slate-50/30'
            }`}>
              <span>Clinical dossier: secure localized payload decryption: true</span>
              <span className="font-sans font-bold text-emerald-600">✓ Compliant clinical assessment container</span>
            </div>
          </div>
        </div>
      )}

      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-905 bg-opacity-75 backdrop-blur-xs font-sans overflow-y-auto">
          <div className={`w-full max-w-2xl rounded-3xl shadow-xl border overflow-hidden p-6 space-y-4 animate-fade-in ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileEdit className={`h-5 w-5 ${activeTheme.primaryText}`} />
                <h3 className="font-display font-black text-sm uppercase tracking-wider">Modify Clinical Record</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingPatient(null)} 
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Patient Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Patient Age</label>
                <input
                  type="number"
                  value={editAge}
                  onChange={(e) => setEditAge(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sex / Gender</label>
                <select
                  value={editSex}
                  onChange={(e) => setEditSex(e.target.value as any)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100 font-bold' : 'bg-white border-slate-200 text-slate-900 font-bold'}`}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Patient Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Clinical Diagnosis</label>
                <select
                  value={editDiagnosis}
                  onChange={(e) => setEditDiagnosis(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-105 font-bold' : 'bg-white border-slate-200 text-slate-900 font-bold'}`}
                >
                  {settings.diagnoses.map((diag) => (
                    <option key={diag} value={diag}>{diag}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Clinical Consultant</label>
                <select
                  value={editConsultant}
                  onChange={(e) => setEditConsultant(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-105 font-bold' : 'bg-white border-slate-200 text-slate-900 font-bold'}`}
                >
                  {settings.consultants.map((con) => (
                    <option key={con} value={con}>{con}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Treatment Protocol</label>
                <select
                  value={editTreatment}
                  onChange={(e) => setEditTreatment(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-105 font-bold' : 'bg-white border-slate-200 text-slate-900 font-bold'}`}
                >
                  {settings.treatments.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Route of Administration</label>
                <select
                  value={editRoute}
                  onChange={(e) => setEditRoute(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-105 font-bold' : 'bg-white border-slate-200 text-slate-900 font-bold'}`}
                >
                  {settings.routes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{settings.labelProcedurePlace || 'Procedure Place'}</label>
                <select
                  value={editProcedurePlace}
                  onChange={(e) => setEditProcedurePlace(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-105 font-bold' : 'bg-white border-slate-200 text-slate-900 font-bold'}`}
                >
                  {(() => {
                    const currentPlaces = settings.procedurePlaces || [
                      'Operating Room A',
                      'Minor Procedure Suite',
                      'Outpatient Treatment Bay 3',
                      'Infusion Lounge'
                    ];
                    const exists = currentPlaces.includes(editProcedurePlace);
                    const listToRender = exists ? currentPlaces : (editProcedurePlace ? [...currentPlaces, editProcedurePlace] : currentPlaces);
                    return listToRender.map((pt) => (
                      <option key={pt} value={pt}>{pt}</option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Product Amount</label>
                <input
                  type="text"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Active Session No</label>
                <input
                  type="number"
                  value={editSessionNo}
                  onChange={(e) => setEditSessionNo(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Treatment Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100 font-sans' : 'bg-white border-slate-200 text-slate-900 font-sans'}`}
                />
              </div>

              <div className="flex items-center gap-2 md:col-span-2 pt-2 border-t border-slate-100/30 dark:border-slate-800/50 select-none">
                <input
                  id="edit_requires_followup"
                  type="checkbox"
                  checked={editRequiresFollowUp}
                  onChange={(e) => setEditRequiresFollowUp(e.target.checked)}
                  className={`h-4.5 w-4.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-300 bg-white'}`}
                />
                <label htmlFor="edit_requires_followup" className="text-[10px] font-bold uppercase text-slate-405 dark:text-slate-350 cursor-pointer">
                  Requires Post-Treatment Follow-Up Scheduler Track
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Practioner Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>

              {/* Follow-Ups list editing inside Edit Patient Form */}
              <div className="md:col-span-2 mt-4 pt-4 border-t dark:border-slate-805 border-slate-100">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-404 mb-3 flex items-center gap-1.5 font-sans">
                  <CalendarCheck2 className="h-4 w-4 text-blue-500" /> Patient Follow-Ups Ledger ({editFollowUps.length})
                </h4>
                {editFollowUps.length === 0 ? (
                  <p className="text-[11px] italic text-slate-500 mb-3">No custom follow-up consultations logged.</p>
                ) : (
                  <div className="space-y-3.5 mb-4 max-h-[300px] overflow-y-auto pr-1">
                    {editFollowUps.map((log, index) => (
                      <div key={log.id || index} className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200'} space-y-2`}>
                        <div className="flex items-center justify-between gap-2.5">
                          <span className="font-mono text-[10px] font-bold uppercase text-slate-400">Follow-Up #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditFollowUps(editFollowUps.filter((_, idx) => idx !== index));
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Delete Follow-Up Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Date</label>
                            <input
                              type="date"
                              value={log.date || ''}
                              onChange={(e) => {
                                const newLogs = [...editFollowUps];
                                newLogs[index] = { ...newLogs[index], date: e.target.value };
                                setEditFollowUps(newLogs);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Status</label>
                            <input
                              type="text"
                              value={log.status || ''}
                              onChange={(e) => {
                                const newLogs = [...editFollowUps];
                                newLogs[index] = { ...newLogs[index], status: e.target.value };
                                setEditFollowUps(newLogs);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Clinician</label>
                            <input
                              type="text"
                              value={log.clinician || ''}
                              onChange={(e) => {
                                const newLogs = [...editFollowUps];
                                newLogs[index] = { ...newLogs[index], clinician: e.target.value };
                                setEditFollowUps(newLogs);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Assessment Notes</label>
                            <textarea
                              value={log.notes || ''}
                              rows={1}
                              onChange={(e) => {
                                const newLogs = [...editFollowUps];
                                newLogs[index] = { ...newLogs[index], notes: e.target.value };
                                setEditFollowUps(newLogs);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    const newLog: FollowUp = {
                      id: 'fu_' + Math.random().toString(36).substring(2, 9),
                      date: new Date().toISOString().substring(0, 10),
                      status: 'Stable',
                      clinician: editConsultant || 'Dr. Attending',
                      notes: ''
                    };
                    setEditFollowUps([...editFollowUps, newLog]);
                  }}
                  className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl font-bold uppercase text-[9px] tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Append New Follow-Up
                </button>
              </div>

              {/* Treatment Sessions editing inside Edit Patient Form */}
              <div className="md:col-span-2 mt-4 pt-4 border-t dark:border-slate-805 border-slate-100">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-404 mb-3 flex items-center gap-1.5 font-sans">
                  <Activity className="h-4 w-4 text-emerald-550" /> Treatment Sessions History ({editTreatmentSessions.length})
                </h4>
                {editTreatmentSessions.length === 0 ? (
                  <p className="text-[11px] italic text-slate-500 mb-3">No additional treatment sessions logged.</p>
                ) : (
                  <div className="space-y-3.5 mb-4 max-h-[300px] overflow-y-auto pr-1">
                    {editTreatmentSessions.map((session, index) => (
                      <div key={session.id || index} className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-emerald-50/5 border-emerald-100'} space-y-2`}>
                        <div className="flex items-center justify-between gap-2.5">
                          <span className="font-mono text-[10px] font-bold uppercase text-slate-400">Session ID: {session.id.substring(0, 5)}...</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTreatmentSessions(editTreatmentSessions.filter((_, idx) => idx !== index));
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Delete Treatment Session"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Session No</label>
                            <input
                              type="number"
                              value={session.sessionNo || ''}
                              onChange={(e) => {
                                const newSessions = [...editTreatmentSessions];
                                newSessions[index] = { ...newSessions[index], sessionNo: Number(e.target.value) };
                                setEditTreatmentSessions(newSessions);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Date</label>
                            <input
                              type="date"
                              value={session.date || ''}
                              onChange={(e) => {
                                const newSessions = [...editTreatmentSessions];
                                newSessions[index] = { ...newSessions[index], date: e.target.value };
                                setEditTreatmentSessions(newSessions);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Dosage</label>
                            <input
                              type="text"
                              value={session.amount || ''}
                              onChange={(e) => {
                                const newSessions = [...editTreatmentSessions];
                                newSessions[index] = { ...newSessions[index], amount: e.target.value };
                                setEditTreatmentSessions(newSessions);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Route</label>
                            <input
                              type="text"
                              value={session.route || ''}
                              onChange={(e) => {
                                const newSessions = [...editTreatmentSessions];
                                newSessions[index] = { ...newSessions[index], route: e.target.value };
                                setEditTreatmentSessions(newSessions);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Consultant</label>
                            <input
                              type="text"
                              value={session.consultant || ''}
                              onChange={(e) => {
                                const newSessions = [...editTreatmentSessions];
                                newSessions[index] = { ...newSessions[index], consultant: e.target.value };
                                setEditTreatmentSessions(newSessions);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Protocol Treatment</label>
                            <input
                              type="text"
                              value={session.treatment || ''}
                              onChange={(e) => {
                                const newSessions = [...editTreatmentSessions];
                                newSessions[index] = { ...newSessions[index], treatment: e.target.value };
                                setEditTreatmentSessions(newSessions);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Session Remarks / Notes</label>
                            <textarea
                              value={session.notes || ''}
                              rows={1}
                              onChange={(e) => {
                                const newSessions = [...editTreatmentSessions];
                                newSessions[index] = { ...newSessions[index], notes: e.target.value };
                                setEditTreatmentSessions(newSessions);
                              }}
                              className={`w-full px-2 py-1 text-[11px] border rounded-lg ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-900'}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    const newSession: TreatmentSession = {
                      id: 'sess_' + Math.random().toString(36).substring(2, 9),
                      sessionNo: editTreatmentSessions.length + 1,
                      date: new Date().toISOString().substring(0, 10),
                      consultant: editConsultant || 'Dr. Attending',
                      treatment: editTreatment || 'Default Standard Therapy',
                      route: editRoute || 'Intravenous (IV) Infusion',
                      amount: editAmount || '1 Unit',
                      notes: '',
                      createdAt: new Date().toISOString()
                    };
                    setEditTreatmentSessions([...editTreatmentSessions, newSession]);
                  }}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl font-bold uppercase text-[9px] tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Append New Session
                </button>
              </div>
            </div>

            {/* Edit Attachments Section */}
            <div className={`p-4 rounded-2xl border mb-4 mt-2 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className={`text-[11px] font-extrabold uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Diagnostic File Attachments ({editAttachments.length})
                  </h4>
                  <p className="text-[9px] text-slate-450 mt-0.5">Manage scans, lab reports, or diagnostics for this patient.</p>
                </div>
                <label
                  htmlFor="edit_modal_attachment_upload"
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300 hover:text-white'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
                  }`}
                >
                  <Upload className="h-3 w-3 text-blue-500" />
                  Attach File
                  <input
                    id="edit_modal_attachment_upload"
                    type="file"
                    onChange={handleEditAttachmentUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {editAttachments.length === 0 ? (
                <div className={`text-[10px] italic p-3 rounded-xl border border-dashed text-center ${
                  isDark ? 'bg-slate-950/40 border-slate-800/80 text-slate-500' : 'bg-white border-slate-200 text-slate-400'
                }`}>
                  No diagnostic files attached to this patient record.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {editAttachments.map((file) => {
                    const isImage = file.type.startsWith('image/');
                    return (
                      <div key={file.id} className={`flex items-center justify-between p-2 rounded-xl border ${
                        isDark ? 'bg-slate-950/60 border-slate-800/85' : 'bg-white border-slate-200 shadow-xs'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isImage ? (
                            <div className="w-8 h-8 rounded border overflow-hidden flex items-center justify-center shrink-0">
                              <img src={file.data} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 font-extrabold text-[9px] uppercase bg-slate-100 text-slate-600 border">
                              {file.name.split('.').pop()?.substring(0, 3) || 'doc'}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`text-[10px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {file.name}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditAttachments((prev) => prev.filter((a) => a.id !== file.id))}
                          className="p-1 rounded-md hover:bg-rose-500/15 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingPatient(null)}
                className={`px-4.5 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest cursor-pointer border ${
                  isDark ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest text-white cursor-pointer bg-blue-600 hover:bg-blue-500 shadow-sm"
              >
                Commit Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

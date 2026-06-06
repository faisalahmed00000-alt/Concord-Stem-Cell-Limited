import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { secureStorage } from '../utils/storage';
import { hashPassword, deriveKey, generateSalt, encrypt } from '../utils/crypto';
import { 
  Settings, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  Activity, 
  User, 
  ShieldCheck, 
  Stethoscope, 
  IterationCcw,
  Palette,
  Sliders,
  Printer,
  Image as ImageIcon,
  FileText,
  Layout,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  FileSpreadsheet, 
  FileDown, 
  Upload, 
  CheckSquare, 
  ShieldAlert, 
  Cloud, 
  Download, 
  RefreshCw, 
  Lock, 
  Key,
  LogOut, 
  ExternalLink, 
  X,
  Compass,
  MessageCircle,
  Send,
  Phone,
  History,
  Search
} from 'lucide-react';
import { FormSettings, THEME_OPTIONS, ThemeOption, ThemeColor, BG_COLOR_OPTIONS } from '../types/settings';
import { Patient } from '../types/patient';
import * as XLSX from 'xlsx';
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
  SpreadsheetMetadata
} from '../utils/googleSheets';
import { User as FirebaseUser } from 'firebase/auth';
import { clinicalCohortData } from '../data/clinicalCohort';

interface SettingsPanelProps {
  settings: FormSettings;
  onUpdateSettings: (newSettings: FormSettings) => void;
  patients: Patient[];
  onImportPatients: (importedList: Patient[], overwrite?: boolean) => Promise<void>;
  userRole?: 'admin' | 'co-admin' | 'user';
  username?: string;
  fullName?: string;
  session?: any;
  onUpdateSession?: (updatedFields: any) => void;
  activeSegment?: 'aesthetics' | 'formKeys' | 'registries' | 'integration' | 'users' | 'printShare' | 'userDetails' | 'adminAuditLog';
  onActiveSegmentChange?: (segment: 'aesthetics' | 'formKeys' | 'registries' | 'integration' | 'users' | 'printShare' | 'userDetails' | 'adminAuditLog') => void;
}

export default function SettingsPanel({ 
  settings, 
  onUpdateSettings, 
  patients, 
  onImportPatients, 
  userRole, 
  username, 
  fullName, 
  session, 
  onUpdateSession,
  activeSegment: propActiveSegment,
  onActiveSegmentChange
}: SettingsPanelProps) {
  const [newDiagnosis, setNewDiagnosis] = useState('');
  const [newRoute, setNewRoute] = useState('');
  const [newProcedurePlace, setNewProcedurePlace] = useState('');
  const [newConsultant, setNewConsultant] = useState('');
  const [newRecoveryStatus, setNewRecoveryStatus] = useState('');
  const [newTreatment, setNewTreatment] = useState('');
  
  const [localActiveSegment, setLocalActiveSegment] = useState<'aesthetics' | 'formKeys' | 'registries' | 'integration' | 'users' | 'printShare' | 'userDetails' | 'auditLogs' | 'adminAuditLog'>('aesthetics');
  const activeSegment = propActiveSegment || localActiveSegment;
  const setActiveSegment = onActiveSegmentChange || setLocalActiveSegment;
  const [showQuickSettingsPanel, setShowQuickSettingsPanel] = useState(false);

  // Compliance tracking and Backup verification states
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [verifiedBackupData, setVerifiedBackupData] = useState<any | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const [themeOpen, setThemeOpen] = useState(true);
  const [bgOpen, setBgOpen] = useState(true);
  const [consultantsOpen, setConsultantsOpen] = useState(true);
  const [diagnosesOpen, setDiagnosesOpen] = useState(true);
  const [routesOpen, setRoutesOpen] = useState(true);
  const [procedurePlacesOpen, setProcedurePlacesOpen] = useState(true);
  const [recoveryStatusesOpen, setRecoveryStatusesOpen] = useState(true);
  const [treatmentsOpen, setTreatmentsOpen] = useState(true);
  const [mandatoryOpen, setMandatoryOpen] = useState(true);
  const [corpIdentityOpen, setCorpIdentityOpen] = useState(true);
  const [formHeadlinesOpen, setFormHeadlinesOpen] = useState(true);
  const [inputLabelsOpen, setInputLabelsOpen] = useState(true);
  
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

  // Google Drive File Explorer states
  const [driveFiles, setDriveFiles] = useState<SpreadsheetMetadata[]>([]);
  const [isDriveFetching, setIsDriveFetching] = useState(false);
  const [driveError, setDriveError] = useState('');

  // Excel Import states
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [parsedPreview, setParsedPreview] = useState<Patient[]>([]);

  // Clinician Administration Panel
  const [dbUsers, setDbUsers] = useState<Record<string, any>>({});
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  const fetchDbUsers = async () => {
    setIsUsersLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setDbUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const [profileFullName, setProfileFullName] = useState(session?.fullName || fullName || '');
  const [profileEmail, setProfileEmail] = useState(session?.email || '');
  const [profileAge, setProfileAge] = useState(session?.age !== undefined ? String(session?.age) : '');
  const [profileSex, setProfileSex] = useState(session?.sex || '');
  const [profileEmployeeId, setProfileEmployeeId] = useState(session?.employeeId || '');
  const [profileDesignation, setProfileDesignation] = useState(session?.designation || '');
  const [profilePhoneNumber, setProfilePhoneNumber] = useState(session?.phoneNumber || '');
  const [profileDepartment, setProfileDepartment] = useState(session?.department || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState('');
  const [profileErrorMessage, setProfileErrorMessage] = useState('');

  const [passwordOld, setPasswordOld] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('');
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');

  useEffect(() => {
    if (session) {
      setProfileFullName(session.fullName || fullName || '');
      setProfileEmail(session.email || '');
      setProfileAge(session.age !== undefined ? String(session.age) : '');
      setProfileSex(session.sex || '');
      setProfileEmployeeId(session.employeeId || '');
      setProfileDesignation(session.designation || '');
      setProfilePhoneNumber(session.phoneNumber || '');
      setProfileDepartment(session.department || '');
    }
  }, [session, fullName]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    setIsSavingProfile(true);
    setProfileSuccessMessage('');
    setProfileErrorMessage('');

    try {
      const res = await fetch('/api/users/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          profileData: {
            fullName: profileFullName,
            email: profileEmail,
            age: profileAge ? Number(profileAge) : undefined,
            sex: profileSex,
            employeeId: profileEmployeeId,
            designation: profileDesignation,
            phoneNumber: profilePhoneNumber,
            department: profileDepartment,
          }
        })
      });

      if (res.ok) {
        setProfileSuccessMessage('Your profile credentials have been synchronized and written to the secure clinical ledger.');
        if (onUpdateSession) {
          onUpdateSession({
            fullName: profileFullName,
            email: profileEmail,
            age: profileAge ? Number(profileAge) : undefined,
            sex: profileSex,
            employeeId: profileEmployeeId,
            designation: profileDesignation,
            phoneNumber: profilePhoneNumber,
            department: profileDepartment,
          });
        }
        // refresh user list too
        fetchDbUsers();
      } else {
        const err = await res.json();
        setProfileErrorMessage(err.error || 'Failed to sync profile changes.');
      }
    } catch (err) {
      setProfileErrorMessage('Network connection lost or server is offline.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setPasswordSuccessMessage('');
    setPasswordErrorMessage('');

    if (!passwordOld) {
      setPasswordErrorMessage('Current Master Password is required.');
      return;
    }
    if (passwordNew.length < 8) {
      setPasswordErrorMessage('New Master Password must be at least 8 characters long.');
      return;
    }
    if (passwordNew !== passwordConfirm) {
      setPasswordErrorMessage('Confirmation does not match new password.');
      return;
    }

    setIsChangingPassword(true);

    try {
      // 1. Fetch current clinician credential setup
      const resGet = await fetch('/api/users');
      if (!resGet.ok) {
        throw new Error('Failed to load active directory from clinical server.');
      }
      const users = await resGet.json();
      const lowerUser = username.toLowerCase().trim();
      const userRecord = users[lowerUser];

      if (!userRecord) {
        throw new Error('Active clinician profile not found.');
      }

      // 2. Verify current password
      const oldVerifier = await hashPassword(passwordOld, userRecord.salt);
      if (oldVerifier !== userRecord.verifierHash) {
        throw new Error('Verification failed. Existing Master Password is incorrect.');
      }

      // Require security answer to lock recovery payload
      const secAnswer = window.prompt(`To protect your offline clinical recovery keys, please verify your security answer to the question:\n\n"${userRecord.securityQuestion || 'What was the name of your first clinical facility?'}"`);
      if (!secAnswer) {
        throw new Error('Cryptographic constraint: A valid security answer is required to encrypt your newly generated recovery ledger block.');
      }

      // 3. Generate new salt and verifier hash
      const newSalt = generateSalt();
      const newVerifierHash = await hashPassword(passwordNew, newSalt);

      // 4. Derive recovery key & encrypt the new password
      const recKey = await deriveKey(secAnswer.toLowerCase().trim(), newSalt);
      const newRecoveryPayload = await encrypt(passwordNew, recKey);

      // 5. Save changes on the backend
      const resPost = await fetch('/api/users/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: lowerUser,
          salt: newSalt,
          verifierHash: newVerifierHash,
          recoveryPayload: newRecoveryPayload
        })
      });

      if (!resPost.ok) {
        const errorData = await resPost.json();
        throw new Error(errorData.error || 'Backend failed to rotate master cryptographic credential.');
      }

      // 6. Update current active local session with the new derived key & raw password
      const newActiveKey = await deriveKey(passwordNew, newSalt);
      if (onUpdateSession) {
        onUpdateSession({
          key: newActiveKey
        });
      }

      // Re-encrypt their local storage patients backup with the newly derived key!
      try {
        const localPatientsStr = secureStorage.getItem('secure_ledger_patients');
        if (localPatientsStr) {
          const pRes = await fetch('/api/patients');
          if (pRes.ok) {
            const serverPatients = await pRes.json();
            const serialized = JSON.stringify(serverPatients);
            const reEncrypted = await encrypt(serialized, newActiveKey);
            secureStorage.setItem('secure_ledger_patients', JSON.stringify(reEncrypted));
          }
        }
      } catch (e) {
        console.warn('Could not re-encrypt local storage patient cache, skipping:', e);
      }

      // Update active session in storage
      secureStorage.setItem('secure_ledger_active_session', JSON.stringify({ username: lowerUser, rawPassword: passwordNew }));

      setPasswordSuccessMessage('Master password and clinical recovery keys rotated successfully.');
      setPasswordOld('');
      setPasswordNew('');
      setPasswordConfirm('');
      
      fetchDbUsers();
    } catch (err: any) {
      setPasswordErrorMessage(err?.message || 'An unexpected error occurred during password rotation.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin') {
      fetchDbUsers();
    }
  }, [userRole]);

  const handleUpdateUserRole = async (targetUser: string, newRole: 'admin' | 'co-admin' | 'user') => {
    if (newRole === 'admin') {
      const confirmTransfer = window.confirm(`Heads-up! You are about to TRANSFER ADMINSHIP to "${targetUser}".\n\nThere can only be exactly 1 Admin. Upon transferring, your own role will be demoted to CO-ADMIN, and this roster page will no longer be accessible to you.\n\nAre you sure you want to proceed?`);
      if (!confirmTransfer) {
        fetchDbUsers();
        return;
      }
    }
    try {
      const res = await fetch('/api/users/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: targetUser, role: newRole })
      });
      if (res.ok) {
        alert(`Privilege successfully modified! "${targetUser}" is now a ${newRole.toUpperCase()}.`);
        if (newRole === 'admin') {
          if (onUpdateSession) {
            onUpdateSession({ role: 'co-admin' });
          }
          window.location.reload();
        } else {
          fetchDbUsers();
        }
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || 'Failed to modify role privilege'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleUpdateUserApproval = async (targetUser: string, newApproval: 'approved' | 'pending' | 'rejected') => {
    try {
      const res = await fetch('/api/users/update-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: targetUser, approval: newApproval })
      });
      if (res.ok) {
        alert(`Access permissions successfully modified! "${targetUser}" is now ${newApproval.toUpperCase()}.`);
        fetchDbUsers();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || 'Failed to modify access status'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

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
      onUpdateSettings({
        ...settings,
        activeSpreadsheetUrl: sheetUrl
      });

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

  // Load the authenticated user on render
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setSheetsAccessToken(token);
        setSheetsStatus({ type: 'success', message: `Connected as ${user.email} (Ready for Google Sheets sync).` });
        handleFetchDriveFiles(token);
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
      }
    } catch (err: any) {
      console.error(err);
      setSheetsStatus({
        type: 'error',
        message: err.message || 'Google Auth login popup failed. Please use manual token fallback if required.'
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

  const handleLoadClinicalTrialCohort = async () => {
    const confirmRestore = confirm(
      "RESTORE SAFETY WARNING:\nYou are about to overwrite your active clinical ledger with the full Spreadsheet Clinical Trial Cohort containing 36 patient cases and 250+ encrypted follow-up logs.\n\nPrerequisite dropdown values (consultants, treatments, diagnoses) will also be configured to match. Proceed?"
    );
    if (!confirmRestore) return;
    
    try {
      setIsSheetsLoading(true);
      
      const newSettings: FormSettings = {
        ...settings,
        consultants: Array.from(new Set([
          ...settings.consultants, 
          'Dr. Shayla Kabir', 
          'Dr. Shahriar Jahan', 
          'Dr. Monzur A Khoda', 
          'Dr. Nahid Hossain', 
          'Dr. Rashidul Akhter', 
          'Dr. Sukriti Das',
          'Dr. Mohammad Mahiuddin'
        ])),
        diagnoses: Array.from(new Set([
          ...settings.diagnoses, 
          'Chronic Kidney Disease', 
          'Autism', 
          'Parkinson\'s Disease, Diabetes', 
          'Diabetes Mellitus, Asthma', 
          'Osteoarthritis Secondary Arthropathy', 
          'Diabetic Sensory Polyneuropathy', 
          'Juvenile Rheumatoid & Fibromyalgia', 
          'Chronic Intractable Pain Syndrome', 
          'Diabetes Mellitus, Erectile Dysfunction',
          'Complex Regional Pain Syndrome (CRPS)'
        ])),
        treatments: Array.from(new Set([
          ...(settings.treatments || []), 
          'Stem Cell (MSC) IV Dextrose Infusion', 
          'Standard Stem Cell Intravenous Protocol', 
          'Stem Cell (MSC) Kidney Micro-Infiltration', 
          'Exosome Infusion Therapy', 
          'Regenerative Joint Infiltration', 
          'Targeted Spine Joint Prolotherapy', 
          'Myofascial Trigger Point Injection'
        ])),
      };
      
      onUpdateSettings(newSettings);
      
      // Overwrite local records with the 36 patients
      await onImportPatients(clinicalCohortData, true);
      
      setImportStatus({
        type: 'success',
        message: 'Clinical trial patient database successfully decrypted, certified, and loaded into AES-256 storage.'
      });
      setShowImport(true);
      alert('Spreadsheet database successfully seeded! 36 clinical trial cohorts with full timelines have been loaded.');
    } catch (e: any) {
      alert(`Seeding failure: ${e.message || e}`);
    } finally {
      setIsSheetsLoading(false);
    }
  };
  
  const activeTheme = THEME_OPTIONS.find(t => t.id === settings.theme) || THEME_OPTIONS[0];

  // Graceful fallback defaults for older profiles
  const appName = settings.appName || 'Concord Stem Cell MSC Record';
  const companyLogo = settings.companyLogo || '';
  const companyAddress = settings.companyAddress || '';
  const companyInfo = settings.companyInfo || '';
  
  const headlineAdmission = settings.headlineAdmission || 'Patient Admission Record';
  const headlineDemographics = settings.headlineDemographics || '1. Core Patient Demographics';
  const headlineParameters = settings.headlineParameters || '2. Clinical Parameters & Protocols';
  const headlineRemarks = settings.headlineRemarks || '3. Admitting Practitioner Remarks';
  const headlineFollowUpTitle = settings.headlineFollowUpTitle || '4. Follow-Up Assessment Timeline';
  const headlineSessionsTitle = settings.headlineSessionsTitle || '5. Treatment Sessions Ledger';
  const printSectionsOrder = settings.printSectionsOrder || ['demographics', 'parameters', 'remarks', 'followups', 'sessions'];
  const printSectionsIncluded = settings.printSectionsIncluded || ['demographics', 'parameters', 'remarks', 'followups', 'sessions'];
  
  const labelPatientCode = settings.labelPatientCode || 'Patient Code/ID';
  const labelPatientName = settings.labelPatientName || 'Patient Full Name';
  const labelAge = settings.labelAge || 'Patient Age';
  const labelSex = settings.labelSex || 'Biological Sex';
  const labelPhone = settings.labelPhone || 'Contact Telephone';
  const labelDiagnosis = settings.labelDiagnosis || 'Admitting Diagnosis';
  const labelConsultant = settings.labelConsultant || 'Attending Consultant';
  const labelTreatment = settings.labelTreatment || 'Active Treatment Protocol';
  const labelRoute = settings.labelRoute || 'Product Route';
  const labelProcedurePlace = settings.labelProcedurePlace || 'Procedure Place';
  const labelAmount = settings.labelAmount || 'Product Dosage';
  const labelNotes = settings.labelNotes || 'Practitioner Notes';

  const handleAddDiagnosis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiagnosis.trim()) return;
    if (settings.diagnoses.includes(newDiagnosis.trim())) {
      alert('This diagnosis list option already exists.');
      return;
    }
    const updated = {
      ...settings,
      diagnoses: [...settings.diagnoses, newDiagnosis.trim()]
    };
    onUpdateSettings(updated);
    setNewDiagnosis('');
  };

  const handleDeleteDiagnosis = (item: string) => {
    const updated = {
      ...settings,
      diagnoses: settings.diagnoses.filter(d => d !== item)
    };
    onUpdateSettings(updated);
  };

  const handleAddRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoute.trim()) return;
    if (settings.routes.includes(newRoute.trim())) {
      alert('This administration route option already exists.');
      return;
    }
    const updated = {
      ...settings,
      routes: [...settings.routes, newRoute.trim()]
    };
    onUpdateSettings(updated);
    setNewRoute('');
  };

  const handleDeleteRoute = (item: string) => {
    const updated = {
      ...settings,
      routes: settings.routes.filter(r => r !== item)
    };
    onUpdateSettings(updated);
  };

  const handleAddProcedurePlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProcedurePlace.trim()) return;
    const currentPlaces = settings.procedurePlaces || [
      'Operating Room A',
      'Minor Procedure Suite',
      'Outpatient Treatment Bay 3',
      'Infusion Lounge'
    ];
    if (currentPlaces.includes(newProcedurePlace.trim())) {
      alert('This procedure place option already exists.');
      return;
    }
    const updated = {
      ...settings,
      procedurePlaces: [...currentPlaces, newProcedurePlace.trim()]
    };
    onUpdateSettings(updated);
    setNewProcedurePlace('');
  };

  const handleDeleteProcedurePlace = (item: string) => {
    const currentPlaces = settings.procedurePlaces || [
      'Operating Room A',
      'Minor Procedure Suite',
      'Outpatient Treatment Bay 3',
      'Infusion Lounge'
    ];
    const updated = {
      ...settings,
      procedurePlaces: currentPlaces.filter(p => p !== item)
    };
    onUpdateSettings(updated);
  };

  const handleAddConsultant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConsultant.trim()) return;
    if (settings.consultants.includes(newConsultant.trim())) {
      alert('This consultant already exists in the registry.');
      return;
    }
    const updated = {
      ...settings,
      consultants: [...settings.consultants, newConsultant.trim()]
    };
    onUpdateSettings(updated);
    setNewConsultant('');
  };

  const handleDeleteConsultant = (item: string) => {
    const updated = {
      ...settings,
      consultants: settings.consultants.filter(c => c !== item)
    };
    onUpdateSettings(updated);
  };

  const handleAddTreatment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTreatment.trim()) return;
    const currentList = settings.treatments || [
      'Excedrin IV Dosing Protocol',
      'Neuromuscular Blockade Protocol',
      'Exosome Infusion Therapy',
      'Standard Stem Cell Intravenous Protocol',
      'Targeted Spine Joint Prolotherapy',
      'Regenerative Joint Infiltration',
      'Myofascial Trigger Point Injection'
    ];
    if (currentList.includes(newTreatment.trim())) {
      alert('This treatment protocol option already exists.');
      return;
    }
    const updated = {
      ...settings,
      treatments: [...currentList, newTreatment.trim()]
    };
    onUpdateSettings(updated);
    setNewTreatment('');
  };

  const handleDeleteTreatment = (item: string) => {
    const currentList = settings.treatments || [
      'Excedrin IV Dosing Protocol',
      'Neuromuscular Blockade Protocol',
      'Exosome Infusion Therapy',
      'Standard Stem Cell Intravenous Protocol',
      'Targeted Spine Joint Prolotherapy',
      'Regenerative Joint Infiltration',
      'Myofascial Trigger Point Injection'
    ];
    const updated = {
      ...settings,
      treatments: currentList.filter(t => t !== item)
    };
    onUpdateSettings(updated);
  };

  const handleAddRecoveryStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecoveryStatus.trim()) return;
    const currentList = settings.recoveryStatuses || [
      'Stable / Maintenance Protocol',
      'Significantly Improved - Ready for Discharge Protocol',
      'Gradual Improvement Observed',
      'No Changes (Symptomatic Plateau)',
      'Minor Flareups / Temporary Regression',
      'Deteriorated / Urgent Re-assessment Required'
    ];
    if (currentList.includes(newRecoveryStatus.trim())) {
      alert('This recovery status already exists.');
      return;
    }
    const updated = {
      ...settings,
      recoveryStatuses: [...currentList, newRecoveryStatus.trim()]
    };
    onUpdateSettings(updated);
    setNewRecoveryStatus('');
  };

  const handleDeleteRecoveryStatus = (item: string) => {
    const currentList = settings.recoveryStatuses || [
      'Stable / Maintenance Protocol',
      'Significantly Improved - Ready for Discharge Protocol',
      'Gradual Improvement Observed',
      'No Changes (Symptomatic Plateau)',
      'Minor Flareups / Temporary Regression',
      'Deteriorated / Urgent Re-assessment Required'
    ];
    const updated = {
      ...settings,
      recoveryStatuses: currentList.filter(s => s !== item)
    };
    onUpdateSettings(updated);
  };

  // Load activity logs when segment is active
  useEffect(() => {
    if (activeSegment === 'auditLogs' || activeSegment === 'adminAuditLog') {
      setLogsLoading(true);
      fetch('/api/logs')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setLogs(data);
          } else {
            setLogs([]);
          }
          setLogsLoading(false);
        })
        .catch(err => {
          console.error('Failed to view audit logs:', err);
          setLogsLoading(false);
        });
    }
  }, [activeSegment]);

  // Cryptographic JSON Checksum Generator
  const sha256 = async (message: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Perform drag & drop or upload backup check
  const handleVerifyBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifyStatus({ type: 'loading', message: 'Analyzing backup structures...' });
    setVerifiedBackupData(null);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backupObj = JSON.parse(text);
        if (!backupObj.payload || !backupObj.integrity) {
          setVerifyStatus({
            type: 'error',
            message: 'Verification Failed: Document does not contain a valid clinical payload or cryptographic signature record block.'
          });
          return;
        }
        
        // Recalculate checksum on the payload node itself
        const checksum = await sha256(JSON.stringify(backupObj.payload));
          
        if (checksum === backupObj.integrity.checksum) {
          setVerifiedBackupData(backupObj.payload);
          setVerifyStatus({
            type: 'success',
            message: `Backup Verified: SHA-256 cryptographic signature matched! Integrity matches original state. Generated on ${new Date(backupObj.integrity.timestamp).toLocaleString()} by ${backupObj.integrity.generatedBy}.`
          });
          // Log verification success
          fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: username || 'system',
              action: 'BACKUP_VERIFY',
              details: `Cryptographic verification succeeded for backup: SHA-256 matched successfully (${checksum.substring(0, 8)}...)`,
              severity: 'info'
            })
          }).catch(err => console.error(err));
        } else {
          setVerifyStatus({
            type: 'error',
            message: `Verification Mismatch: SHA-256 signature failed verification. The backup file may be corrupted or tampered with!`
          });
          // Log verification failure
          fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: username || 'system',
              action: 'BACKUP_VERIFY_FAILED',
              details: `Cryptographic verification failed: Signatures did not match! Data has been modified.`,
              severity: 'warn'
            })
          }).catch(err => console.error(err));
        }
      } catch (err) {
        setVerifyStatus({ type: 'error', message: 'Corrupted Backups Profile: Unable to parse file as valid JSON.' });
      }
    };
    reader.readAsText(file);
  };

  const handleExportBackup = async () => {
    // Compile and sign local clinical payload
    const payload = {
      patients,
      settings,
      users: Object.fromEntries(Object.entries(dbUsers).map(([k, v]: [string, any]) => [k, { fullName: v.fullName, role: v.role, specialty: v.specialty }]))
    };
    
    try {
      const checksum = await sha256(JSON.stringify(payload));
      const backupFileObj = {
        payload,
        integrity: {
          checksum,
          timestamp: new Date().toISOString(),
          generatedBy: fullName || username || 'admin'
        }
      };
      
      const blob = new Blob([JSON.stringify(backupFileObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `EHR_SECURE_BACKUP_${new Date().toISOString().split('T')[0]}_HN${checksum.substring(0, 6).toUpperCase()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Log exported backup
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username || 'system',
          action: 'BACKUP_EXPORT',
          details: `Exported secure cryptographic backup with signature: ${checksum.substring(0, 8)}...`,
          severity: 'info'
        })
      }).catch(err => console.error(err));
      
      // Reload logs immediately
      setTimeout(() => {
        fetch('/api/logs')
          .then(res => res.json())
          .then(data => { if (Array.isArray(data)) setLogs(data); });
      }, 500);
      
    } catch (e) {
      console.error('Failed to generate secure backup:', e);
    }
  };

  const handleRestoreBackup = async () => {
    if (!verifiedBackupData) return;
    const confirmRestore = confirm("CRITICAL RESTORE WARNING:\nThis action will overwrite your current active clinical roster, patient directory, and clinics metadata with the verified backup profile.\n\nThis cannot be undone. Are you absolutely sure?");
    if (!confirmRestore) return;
    
    try {
      if (verifiedBackupData.patients) {
        const res = await fetch('/api/patients/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifiedBackupData.patients)
        });
        if (res.ok) {
          if (verifiedBackupData.settings) {
            onUpdateSettings(verifiedBackupData.settings);
          }
          alert("Database Restore Succeeded! Re-syncing and updating main interface.");
          window.location.reload();
        } else {
          alert("Restore Failed during raw patient synchronization.");
        }
      }
    } catch (err) {
      alert("An error occurred during database restore.");
    }
  };

  const handleSelectTheme = (themeId: ThemeColor) => {
    const updated = {
      ...settings,
      theme: themeId
    };
    onUpdateSettings(updated);
  };

  const handleSelectBgColor = (bgColorId: 'default' | 'sand' | 'mint' | 'lilac' | 'blueish' | 'stark') => {
    const updated = {
      ...settings,
      appBgColor: bgColorId
    };
    onUpdateSettings(updated);
  };

  const handleToggleMandatoryField = (fieldId: string) => {
    const currentList = settings.mandatoryFields || ['name', 'age', 'phone', 'diagnosis', 'consultant', 'treatment'];
    const newList = currentList.includes(fieldId)
      ? currentList.filter(f => f !== fieldId)
      : [...currentList, fieldId];
    
    const updated = {
      ...settings,
      mandatoryFields: newList
    };
    onUpdateSettings(updated);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert('Practice logo image file size must be less than 1.5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const updated = {
            ...settings,
            companyLogo: event.target.result as string
          };
          onUpdateSettings(updated);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTogglePrintSection = (secId: string) => {
    const list = settings.printSectionsIncluded || ['demographics', 'parameters', 'remarks', 'followups', 'sessions'];
    const updated = list.includes(secId) 
      ? list.filter(x => x !== secId)
      : [...list, secId];
    handleUpdateSetting('printSectionsIncluded', updated);
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const currentOrder = settings.printSectionsOrder || ['demographics', 'parameters', 'remarks', 'followups', 'sessions'];
    const newOrder = [...currentOrder];
    if (direction === 'up' && index > 0) {
      const temp = newOrder[index];
      newOrder[index] = newOrder[index - 1];
      newOrder[index - 1] = temp;
    } else if (direction === 'down' && index < newOrder.length - 1) {
      const temp = newOrder[index];
      newOrder[index] = newOrder[index + 1];
      newOrder[index + 1] = temp;
    }
    onUpdateSettings({
      ...settings,
      printSectionsOrder: newOrder
    });
  };

  const handleUpdateCustomField = (field: keyof FormSettings, value: string) => {
    const updated = {
      ...settings,
      [field]: value
    };
    onUpdateSettings(updated);
  };

  const handleUpdateSetting = (field: keyof FormSettings, value: any) => {
    const updated = {
      ...settings,
      [field]: value
    };
    onUpdateSettings(updated);
  };

  const handleResetDefaults = () => {
    if (!confirm('Are you sure you want to reset all dropdown variables to initial defaults? Custom items will be wiped.')) return;
    onUpdateSettings({
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
      companyLogo: '/src/assets/images/concord_logo_1780689503864.png',
      companyAddress: '',
      companyInfo: '',
      headlineAdmission: 'Patient Admission Record',
      headlineDemographics: '1. Core Patient Demographics',
      headlineParameters: '2. Clinical Parameters & Protocols',
      headlineRemarks: '3. Admitting Practitioner Remarks',
      headlineFollowUpTitle: '4. Follow-Up Assessment Timeline',
      labelPatientCode: 'Patient Code/ID',
      labelPatientName: 'Patient Full Name',
      labelAge: 'Patient Age',
      labelSex: 'Biological Sex',
      labelPhone: 'Contact Telephone',
      labelDiagnosis: 'Admitting Diagnosis',
      labelConsultant: 'Attending Consultant',
      labelTreatment: 'Active Treatment Protocol',
      labelRoute: 'Product Route',
      labelAmount: 'Product Dosage',
      labelNotes: 'Practitioner Notes'
    });
  };

  const isDark = activeTheme.isDark;

  return (
    <div id="settings_panel_layout" className="space-y-6 font-sans max-w-6xl mx-auto">
      {/* Header card */}
      <div className={`border rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl text-white ${activeTheme.primaryBg}`}>
              {userRole === 'user' ? <User className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
            </div>
            <div>
              <h2 className={`text-base font-extrabold uppercase tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                {userRole === 'user' ? 'My Profile Details' : 'Settings'}
              </h2>
              <p className={`text-[12px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                {userRole === 'user' ? 'Manage your clinician display credentials and active profile card' : 'Configure entry forms variables and user aesthetics'}
              </p>
            </div>
          </div>
        </div>

        {/* Clinician Active Info Badge (At top middle of settings layout) */}
        {fullName && (
          <div 
            className={`flex items-center gap-2 border rounded-xl px-3 py-1 shadow-none md:mx-auto max-w-[200px] ${
              isDark ? 'bg-slate-950 border-slate-850' : 'bg-slate-50 border-slate-200/60'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            </span>
            <div className="text-left leading-none">
              <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Active Clinician</span>
              <p className={`text-[10px] font-black leading-tight truncate ${isDark ? 'text-slate-200' : 'text-slate-805'}`}>
                {fullName}
              </p>
            </div>
          </div>
        )}

        {userRole !== 'user' && (
          <button
            onClick={handleResetDefaults}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-705 border-slate-700 text-slate-300' 
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <IterationCcw className="h-3.5 w-3.5" /> Reset Variables
          </button>
        )}
      </div>

      {/* Navigation Segmented Tabs bar */}
      <div className={`border rounded-2xl p-1.5 flex flex-wrap gap-1.5 ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-[#E5E9EE]'
      }`}>
        {userRole !== 'user' && (
          <>
            <button
              type="button"
              onClick={() => setActiveSegment('aesthetics')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeSegment === 'aesthetics'
                  ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <Palette className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
              <span>Theme</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSegment('formKeys')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeSegment === 'formKeys'
                  ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <Sliders className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
              <span>Form setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSegment('registries')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeSegment === 'registries'
                  ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <Stethoscope className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
              <span>Dropdown Registries</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSegment('integration')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeSegment === 'integration'
                  ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <Cloud className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
              <span>Data Sync & Import</span>
            </button>
 
            <button
              type="button"
              onClick={() => setActiveSegment('printShare')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeSegment === 'printShare'
                  ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <Printer className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
              <span>Print / Share Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSegment('auditLogs')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeSegment === 'auditLogs'
                  ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/50' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <Activity className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
              <span>Compliance Audit</span>
            </button>
          </>
        )}
 
        <button
          type="button"
          onClick={() => setActiveSegment('userDetails')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeSegment === 'userDetails'
              ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
              : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
          }`}
        >
          <User className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
          <span>User Details</span>
        </button>
 
        {userRole === 'admin' && (
          <>
            <button
              type="button"
              onClick={() => setActiveSegment('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeSegment === 'users'
                  ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <ShieldCheck className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
              <span>Staff Roster Roles</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSegment('adminAuditLog')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeSegment === 'adminAuditLog'
                  ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm border border-slate-200/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <History className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
              <span>Admin Audit Log</span>
            </button>
          </>
        )}
      </div>

      {activeSegment === 'aesthetics' && (
        <div id="settings_aesthetics_segment_group" className="space-y-6 animate-fade-in duration-300">
          {/* Theme picker */}
          <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          } ${themeOpen ? 'space-y-4' : 'space-y-0'}`}>
        <div 
          onClick={() => setThemeOpen(!themeOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Palette className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Theme Color
            </h3>
          </div>
          {themeOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
        {themeOpen && (
          <div className={`pt-2 border-t space-y-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
              Select an ambient interface color. Color mappings are optimized for low-light clinical settings such as Dark Slate mode.
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 pt-1">
              {THEME_OPTIONS.map((theme) => {
                const isSelected = settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`flex flex-col items-center justify-center p-3 border rounded-2xl transition-all cursor-pointer text-center relative ${
                      isSelected 
                        ? `${theme.borderColor} ${theme.accentBg} ring-2 ring-offset-2 ${isDark ? 'ring-slate-950' : 'ring-slate-100'}` 
                        : isDark ? 'border-slate-800 hover:bg-slate-800/40' : 'border-slate-250 hover:bg-slate-50/50'
                    }`}
                  >
                    {isSelected && (
                      <span className={`absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] ${theme.indicatorBg}`}>
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                    <span className={`w-8 h-8 rounded-full shadow-inner mb-2 flex items-center justify-center ${theme.primaryBg}`}>
                      <Activity className="h-4 w-4 text-white" />
                    </span>
                    <span className={`text-[10px] font-bold block tracking-tight truncate w-full ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {theme.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Multiple Background Options Selection card */}
      <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      } ${bgOpen ? 'space-y-4' : 'space-y-0'}`}>
        <div 
          onClick={() => setBgOpen(!bgOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Palette className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              App Background Color
            </h3>
          </div>
          {bgOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
        {bgOpen && (
          <div className={`pt-2 border-t space-y-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
              Choose standard backgrounds to customize visual density and eye ergonomics across dark and light modes.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 font-sans">
              {BG_COLOR_OPTIONS.map((bg) => {
                const isSelected = (settings.appBgColor || 'default') === bg.id;
                return (
                  <button
                    key={bg.id}
                    onClick={() => handleSelectBgColor(bg.id)}
                    className={`flex items-center gap-2.5 p-3.5 border rounded-2xl transition-all cursor-pointer text-left relative ${
                      isSelected 
                        ? `${activeTheme.borderColor} ${activeTheme.accentBg} ring-2 ring-offset-2 ${isDark ? 'ring-slate-950' : 'ring-slate-100'}` 
                        : isDark ? 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/40' : 'border-slate-200 bg-slate-50/20 hover:bg-slate-100/40'
                    }`}
                  >
                    <div className={`h-4.5 w-4.5 rounded-full shrink-0 shadow-xs ${bg.colorDot}`} />
                    <span className={`text-[10px] font-bold block tracking-tight truncate w-full ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {bg.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
        </div>
      )}

      {activeSegment === 'formKeys' && (
        <div id="settings_form_keys_segment_group" className="space-y-6 animate-fade-in duration-300">
          {/* Mandatory Configuration block */}
          <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      } ${mandatoryOpen ? 'space-y-4' : 'space-y-0'}`}>
        <div 
          onClick={() => setMandatoryOpen(!mandatoryOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <FileText className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Mandatory Fields Configuration
            </h3>
          </div>
          {mandatoryOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
        {mandatoryOpen && (
          <div className={`pt-2 border-t space-y-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
              Select patient data fields from the dropdown option below to toggle whether they must be completed.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-1/2">
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Select Option to Toggle Requirement Status
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleToggleMandatoryField(e.target.value);
                      e.target.value = ""; // Reset dropdown after toggling
                    }
                  }}
                  defaultValue=""
                  className={`block w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                    isDark ? 'bg-slate-900 border-slate-805 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="" disabled className="font-bold">-- Select Field from Dropdown... --</option>
                  {[
                    { id: 'name', name: 'Patient Full Name' },
                    { id: 'phone', name: 'Contact Telephone' },
                    { id: 'age', name: 'Patient Age' },
                    { id: 'sex', name: 'Biological Sex' },
                    { id: 'diagnosis', name: 'Admitting Diagnosis' },
                    { id: 'consultant', name: 'Attending Consultant' },
                    { id: 'treatment', name: 'Treatment Protocol' },
                    { id: 'route', name: 'Product Route' },
                    { id: 'amount', name: 'Product Dosage' },
                    { id: 'notes', name: 'Practitioner Remarks' },
                  ].map((field) => {
                    const isChecked = (settings.mandatoryFields || ['name', 'age', 'phone', 'diagnosis', 'consultant', 'treatment']).includes(field.id);
                    return (
                      <option key={field.id} value={field.id} className="cursor-pointer">
                        {field.name} {isChecked ? '(✓ Required)' : '(Optional)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="w-full sm:w-1/2">
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Required Fields (Configured Items)
                </label>
                {/* Scrollable list restricted to exactly 3 lines of display height */}
                <div className={`border rounded-xl divide-y max-h-[105px] overflow-y-auto pr-1 ${
                  isDark ? 'border-slate-800 bg-slate-950 divide-slate-800' : 'border-slate-200 bg-slate-50/50 divide-slate-150'
                }`}>
                  {[
                    { id: 'name', name: 'Patient Full Name' },
                    { id: 'phone', name: 'Contact Telephone' },
                    { id: 'age', name: 'Patient Age' },
                    { id: 'sex', name: 'Biological Sex' },
                    { id: 'diagnosis', name: 'Admitting Diagnosis' },
                    { id: 'consultant', name: 'Attending Consultant' },
                    { id: 'treatment', name: 'Treatment Protocol' },
                    { id: 'route', name: 'Product Route' },
                    { id: 'amount', name: 'Product Dosage' },
                    { id: 'notes', name: 'Practitioner Remarks' },
                  ].filter(field => (settings.mandatoryFields || ['name', 'age', 'phone', 'diagnosis', 'consultant', 'treatment']).includes(field.id)).map((field) => (
                    <div key={field.id} className="px-3 py-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      <span className="truncate">{field.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleMandatoryField(field.id)}
                        className="text-red-500 hover:text-red-600 transition-colors cursor-pointer text-[10px] uppercase font-bold shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {[
                    { id: 'name', name: 'Patient Full Name' },
                    { id: 'phone', name: 'Contact Telephone' },
                    { id: 'age', name: 'Patient Age' },
                    { id: 'sex', name: 'Biological Sex' },
                    { id: 'diagnosis', name: 'Admitting Diagnosis' },
                    { id: 'consultant', name: 'Attending Consultant' },
                    { id: 'treatment', name: 'Treatment Protocol' },
                    { id: 'route', name: 'Product Route' },
                    { id: 'amount', name: 'Product Dosage' },
                    { id: 'notes', name: 'Practitioner Remarks' },
                  ].filter(field => !(settings.mandatoryFields || ['name', 'age', 'phone', 'diagnosis', 'consultant', 'treatment']).includes(field.id)).length === 10 && (
                    <p className="text-[10px] text-slate-400 p-3 italic">All fields are configured as optional.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NEW SECTION: App customization headings & company logo */}
      <div className={`border rounded-3xl p-6 shadow-sm space-y-5 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div className={`border-b pb-3 flex items-center gap-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <Sliders className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            🏥 App Customisation
          </h3>
        </div>
        
        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
          Edit practice identity, upload branding logos, and customize section headlines or form field labels displayed throughout the clinical registry.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo & Identity */}
          <div className={`p-4 rounded-2xl border transition-all duration-300 ${
            isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200/60'
          } ${corpIdentityOpen ? 'space-y-4' : 'space-y-0'}`}>
            <div 
              onClick={() => setCorpIdentityOpen(!corpIdentityOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> 1. Practice Corporate Identity
              </h4>
              {corpIdentityOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
            </div>

            {corpIdentityOpen && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Company / App Name
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => handleUpdateCustomField('appName', e.target.value)}
                    className={`block w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Practice Address (for PDF bottom info)
                  </label>
                  <textarea
                    rows={2}
                    value={companyAddress}
                    onChange={(e) => handleUpdateCustomField('companyAddress', e.target.value)}
                    placeholder="e.g. AMZ Hospital, House-1, Road-2, Dhaka-1212"
                    className={`block w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Additional Information (for PDF bottom info)
                  </label>
                  <textarea
                    rows={2}
                    value={companyInfo}
                    onChange={(e) => handleUpdateCustomField('companyInfo', e.target.value)}
                    placeholder="e.g. Shift Duty Clinic: +880123456789 | Web: info@amzhospital.com"
                    className={`block w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Admin Company Logo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {companyLogo && (
                    <div className="mt-3 flex items-center gap-3">
                      <img src={companyLogo} alt="Company Practice Logo" className="h-10 max-w-[150px] object-contain border border-slate-200 p-1 bg-white rounded" referrerPolicy="no-referrer" />
                      <button 
                        type="button" 
                        onClick={() => handleUpdateCustomField('companyLogo', '')} 
                        className="text-[10px] text-red-500 font-bold uppercase hover:underline"
                      >
                        Delete Logo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Form Headlines */}
          <div className={`p-4 rounded-2xl border transition-all duration-300 ${
            isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200/60'
          } ${formHeadlinesOpen ? 'space-y-4' : 'space-y-0'}`}>
            <div 
              onClick={() => setFormHeadlinesOpen(!formHeadlinesOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> 2. Form Headlines & titles
              </h4>
              {formHeadlinesOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
            </div>

            {formHeadlinesOpen && (
              <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1 pt-2">
                <div>
                  <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Admission Form Title</label>
                  <input
                    type="text"
                    value={headlineAdmission}
                    onChange={(e) => handleUpdateCustomField('headlineAdmission', e.target.value)}
                    className={`block w-full px-2.5 py-1.5 border rounded-lg text-xs ${
                      isDark ? 'bg-slate-900 border-slate-850 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Section 1: Demographics Title</label>
                  <input
                    type="text"
                    value={headlineDemographics}
                    onChange={(e) => handleUpdateCustomField('headlineDemographics', e.target.value)}
                    className={`block w-full px-2.5 py-1.5 border rounded-lg text-xs ${
                      isDark ? 'bg-slate-900 border-slate-850 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Section 2: Clinical Parameters Title</label>
                  <input
                    type="text"
                    value={headlineParameters}
                    onChange={(e) => handleUpdateCustomField('headlineParameters', e.target.value)}
                    className={`block w-full px-2.5 py-1.5 border rounded-lg text-xs ${
                      isDark ? 'bg-slate-900 border-slate-850 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Section 3: Remarks Title</label>
                  <input
                    type="text"
                    value={headlineRemarks}
                    onChange={(e) => handleUpdateCustomField('headlineRemarks', e.target.value)}
                    className={`block w-full px-2.5 py-1.5 border rounded-lg text-xs ${
                      isDark ? 'bg-slate-900 border-slate-850 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Section 4: Follow-Ups Timeline Title</label>
                  <input
                    type="text"
                    value={headlineFollowUpTitle}
                    onChange={(e) => handleUpdateCustomField('headlineFollowUpTitle', e.target.value)}
                    className={`block w-full px-2.5 py-1.5 border rounded-lg text-xs ${
                      isDark ? 'bg-slate-900 border-slate-850 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Labels Customization */}
        <div className={`p-4 rounded-xl border transition-all duration-300 ${
          isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200/60'
        } ${inputLabelsOpen ? 'space-y-3' : 'space-y-0'}`}>
          <div 
            onClick={() => setInputLabelsOpen(!inputLabelsOpen)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
              🏷️ 3. Form Input Text Fields Labels & Headlines
            </h4>
            {inputLabelsOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
          </div>
          
          {inputLabelsOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Patient Code/ID</label>
                <input
                  type="text"
                  value={labelPatientCode}
                  onChange={(e) => handleUpdateCustomField('labelPatientCode', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Patient Name</label>
                <input
                  type="text"
                  value={labelPatientName}
                  onChange={(e) => handleUpdateCustomField('labelPatientName', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Patient Age</label>
                <input
                  type="text"
                  value={labelAge}
                  onChange={(e) => handleUpdateCustomField('labelAge', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Biological Sex</label>
                <input
                  type="text"
                  value={labelSex}
                  onChange={(e) => handleUpdateCustomField('labelSex', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Telephone Number</label>
                <input
                  type="text"
                  value={labelPhone}
                  onChange={(e) => handleUpdateCustomField('labelPhone', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-805'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Diagnosis Label</label>
                <input
                  type="text"
                  value={labelDiagnosis}
                  onChange={(e) => handleUpdateCustomField('labelDiagnosis', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Attending Consultant</label>
                <input
                  type="text"
                  value={labelConsultant}
                  onChange={(e) => handleUpdateCustomField('labelConsultant', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Active Treatment Protocol</label>
                <input
                  type="text"
                  value={labelTreatment}
                  onChange={(e) => handleUpdateCustomField('labelTreatment', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-905 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Product Route</label>
                <input
                  type="text"
                  value={labelRoute}
                  onChange={(e) => handleUpdateCustomField('labelRoute', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-805'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Procedure Place</label>
                <input
                  type="text"
                  value={labelProcedurePlace}
                  onChange={(e) => handleUpdateCustomField('labelProcedurePlace', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-805'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Dosage / Amount</label>
                <input
                  type="text"
                  value={labelAmount}
                  onChange={(e) => handleUpdateCustomField('labelAmount', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-405' : 'text-slate-500'}`}>Clinical Remarks</label>
                <input
                  type="text"
                  value={labelNotes}
                  onChange={(e) => handleUpdateCustomField('labelNotes', e.target.value)}
                  className={`block w-full px-2 py-1 border rounded-lg text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            </div>
          )}
        </div>     </div>
        </div>
      )}

      {activeSegment === 'registries' && (
        <div id="settings_registries_segment_group" className="space-y-5 animate-fade-in duration-300">
          <div className="flex flex-col gap-1 pl-1">
            <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-850'}`}>
              Medical Dropdown Registries
            </h3>
            <p className="text-[10px] text-slate-400">
              Configure items and options to populate clinical input selectors when registering or evaluating patients.
            </p>
          </div>
          
          {/* Settings lists split */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Consultants */}
            <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 flex flex-col justify-between h-fit ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        } ${consultantsOpen ? 'space-y-4' : 'space-y-0'}`}>
          <div className="space-y-3.5">
            <div 
              onClick={() => setConsultantsOpen(!consultantsOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <User className={`h-4 w-4 ${activeTheme.primaryText}`} />
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Clinical Consultants</h4>
              </div>
              {consultantsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            {consultantsOpen && (
              <div className={`pt-2 border-t space-y-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <form onSubmit={handleAddConsultant} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Dr. Jordan Carter, MD"
                    value={newConsultant}
                    onChange={(e) => setNewConsultant(e.target.value)}
                    className={`block w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-450 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    Add
                  </button>
                </form>

                <div className={`max-h-60 overflow-y-auto border rounded-xl divide-y ${
                  isDark ? 'border-slate-800 bg-slate-955 split-y divide-slate-800' : 'border-slate-100 bg-slate-50/20 divide-slate-100'
                }`}>
                  {settings.consultants.length === 0 ? (
                    <p className="text-[10px] text-slate-400 p-3 italic">No consultants configured.</p>
                  ) : (
                    settings.consultants.map((consultant) => (
                      <div key={consultant} className={`px-3 py-2 flex items-center justify-between text-xs ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <span className={`font-bold truncate pr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{consultant}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteConsultant(consultant)}
                          className="text-slate-405 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove option"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {consultantsOpen && <p className="text-[9px] text-slate-400 font-medium pt-3">Controls Attending MD entries on patient records.</p>}
        </div>

        {/* Diagnosis entries */}
        <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 flex flex-col justify-between h-fit ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        } ${diagnosesOpen ? 'space-y-4' : 'space-y-0'}`}>
          <div className="space-y-3.5">
            <div 
              onClick={() => setDiagnosesOpen(!diagnosesOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <Stethoscope className={`h-4 w-4 ${activeTheme.primaryText}`} />
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Clinical Diagnoses</h4>
              </div>
              {diagnosesOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            {diagnosesOpen && (
              <div className={`pt-2 border-t space-y-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <form onSubmit={handleAddDiagnosis} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fibromyalgia Syndrome"
                    value={newDiagnosis}
                    onChange={(e) => setNewDiagnosis(e.target.value)}
                    className={`block w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-450 ${
                      isDark ? 'bg-slate-955 border-slate-850 text-slate-100 placeholder-slate-650' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    Add
                  </button>
                </form>

                <div className={`max-h-60 overflow-y-auto border rounded-xl divide-y ${
                  isDark ? 'border-slate-800 bg-slate-950/20 divide-slate-800' : 'border-slate-100 bg-slate-50/20 divide-slate-100'
                }`}>
                  {settings.diagnoses.length === 0 ? (
                    <p className="text-[10px] text-slate-400 p-3 italic">No medical records configured.</p>
                  ) : (
                    settings.diagnoses.map((diag) => (
                      <div key={diag} className={`px-3 py-2 flex items-center justify-between text-xs ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <span className={`font-bold truncate pr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={diag}>{diag}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteDiagnosis(diag)}
                          className="text-slate-405 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove option"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {diagnosesOpen && <p className="text-[9px] text-slate-400 font-medium font-sans pt-3">Controls Diagnosis dropdown select cards on Admission.</p>}
        </div>

        {/* Administration routes */}
        <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 flex flex-col justify-between h-fit ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        } ${routesOpen ? 'space-y-4' : 'space-y-0'}`}>
          <div className="space-y-3.5">
            <div 
              onClick={() => setRoutesOpen(!routesOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <Activity className={`h-4 w-4 ${activeTheme.primaryText}`} />
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Administration Routes</h4>
              </div>
              {routesOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            {routesOpen && (
              <div className={`pt-2 border-t space-y-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <form onSubmit={handleAddRoute} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Intrathecal Therapy"
                    value={newRoute}
                    onChange={(e) => setNewRoute(e.target.value)}
                    className={`block w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-450 ${
                      isDark ? 'bg-slate-955 border-slate-850 text-slate-100 placeholder-slate-650' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    Add
                  </button>
                </form>

                <div className={`max-h-60 overflow-y-auto border rounded-xl divide-y ${
                  isDark ? 'border-slate-800 bg-slate-950/20 divide-slate-800' : 'border-slate-100 bg-slate-50/20 divide-slate-100'
                }`}>
                  {settings.routes.length === 0 ? (
                    <p className="text-[10px] text-slate-400 p-3 italic">No routes configured.</p>
                  ) : (
                    settings.routes.map((rt) => (
                      <div key={rt} className={`px-3 py-2 flex items-center justify-between text-xs ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <span className={`font-bold truncate pr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={rt}>{rt}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoute(rt)}
                          className="text-slate-455 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove option"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {routesOpen && <p className="text-[9px] text-slate-400 font-medium font-sans pt-3">Controls routes of injection or therapy on admission entry forms.</p>}
        </div>

        {/* Procedure places */}
        <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 flex flex-col justify-between h-fit ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        } ${procedurePlacesOpen ? 'space-y-4' : 'space-y-0'}`}>
          <div className="space-y-3.5">
            <div 
              onClick={() => setProcedurePlacesOpen(!procedurePlacesOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <Compass className={`h-4 w-4 ${activeTheme.primaryText}`} />
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Procedure Places</h4>
              </div>
              {procedurePlacesOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            {procedurePlacesOpen && (
              <div className={`pt-2 border-t space-y-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <form onSubmit={handleAddProcedurePlace} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ward 4B, Room 302"
                    value={newProcedurePlace}
                    onChange={(e) => setNewProcedurePlace(e.target.value)}
                    className={`block w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-450 ${
                      isDark ? 'bg-slate-955 border-slate-850 text-slate-100 placeholder-slate-650' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    Add
                  </button>
                </form>

                <div className={`max-h-60 overflow-y-auto border rounded-xl divide-y ${
                  isDark ? 'border-slate-800 bg-slate-950/20 divide-slate-800' : 'border-slate-100 bg-slate-50/20 divide-slate-100'
                }`}>
                  {!(settings.procedurePlaces || [
                    'Operating Room A',
                    'Minor Procedure Suite',
                    'Outpatient Treatment Bay 3',
                    'Infusion Lounge'
                  ]).length ? (
                    <p className="text-[10px] text-slate-400 p-3 italic">No procedure places configured.</p>
                  ) : (
                    (settings.procedurePlaces || [
                      'Operating Room A',
                      'Minor Procedure Suite',
                      'Outpatient Treatment Bay 3',
                      'Infusion Lounge'
                    ]).map((pt) => (
                      <div key={pt} className={`px-3 py-2 flex items-center justify-between text-xs ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <span className={`font-bold truncate pr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={pt}>{pt}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteProcedurePlace(pt)}
                          className="text-slate-455 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove option"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {procedurePlacesOpen && <p className="text-[9px] text-slate-400 font-medium font-sans pt-3">Controls physical room or location options on patient entry forms.</p>}
        </div>

        {/* Recovery Statuses */}
        <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 flex flex-col justify-between h-fit ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        } ${recoveryStatusesOpen ? 'space-y-4' : 'space-y-0'}`}>
          <div className="space-y-3.5">
            <div 
              onClick={() => setRecoveryStatusesOpen(!recoveryStatusesOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <IterationCcw className={`h-4 w-4 ${activeTheme.primaryText}`} />
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Recovery Statuses</h4>
              </div>
              {recoveryStatusesOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            {recoveryStatusesOpen && (
              <div className={`pt-2 border-t space-y-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <form onSubmit={handleAddRecoveryStatus} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Significantly Improved"
                    value={newRecoveryStatus}
                    onChange={(e) => setNewRecoveryStatus(e.target.value)}
                    className={`block w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-450 ${
                      isDark ? 'bg-slate-955 border-slate-850 text-slate-100 placeholder-slate-650' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    Add
                  </button>
                </form>

                <div className={`max-h-60 overflow-y-auto border rounded-xl divide-y ${
                  isDark ? 'border-slate-800 bg-slate-950/20 divide-slate-800' : 'border-slate-100 bg-slate-50/20 divide-slate-100'
                }`}>
                  {(settings.recoveryStatuses || [
                    'Stable / Maintenance Protocol',
                    'Significantly Improved - Ready for Discharge Protocol',
                    'Gradual Improvement Observed',
                    'No Changes (Symptomatic Plateau)',
                    'Minor Flareups / Temporary Regression',
                    'Deteriorated / Urgent Re-assessment Required'
                  ]).length === 0 ? (
                    <p className="text-[10px] text-slate-400 p-3 italic">No statuses configured.</p>
                  ) : (
                    (settings.recoveryStatuses || [
                      'Stable / Maintenance Protocol',
                      'Significantly Improved - Ready for Discharge Protocol',
                      'Gradual Improvement Observed',
                      'No Changes (Symptomatic Plateau)',
                      'Minor Flareups / Temporary Regression',
                      'Deteriorated / Urgent Re-assessment Required'
                    ]).map((rs) => (
                      <div key={rs} className={`px-3 py-2 flex items-center justify-between text-xs ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <span className={`font-bold truncate pr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={rs}>{rs}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecoveryStatus(rs)}
                          className="text-slate-455 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove option"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {recoveryStatusesOpen && <p className="text-[9px] text-slate-400 font-medium font-sans pt-3">Controls therapeutic recovery options visible on follow-up forms.</p>}
        </div>
        
        {/* Active Treatment Protocols */}
        <div className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 flex flex-col justify-between h-fit ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        } ${treatmentsOpen ? 'space-y-4' : 'space-y-0'}`}>
          <div className="space-y-3.5">
            <div 
              onClick={() => setTreatmentsOpen(!treatmentsOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <HeartPulse className={`h-4 w-4 ${activeTheme.primaryText}`} />
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Treatment Protocols</h4>
              </div>
              {treatmentsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            {treatmentsOpen && (
              <div className={`pt-2 border-t space-y-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <form onSubmit={handleAddTreatment} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Exosome Infusion"
                    value={newTreatment}
                    onChange={(e) => setNewTreatment(e.target.value)}
                    className={`block w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-450 ${
                      isDark ? 'bg-slate-955 border-slate-850 text-slate-100 placeholder-slate-650' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    Add
                  </button>
                </form>

                <div className={`max-h-60 overflow-y-auto border rounded-xl divide-y ${
                  isDark ? 'border-slate-800 bg-slate-950/20 divide-slate-800' : 'border-slate-100 bg-slate-50/20 divide-slate-100'
                }`}>
                  {(settings.treatments || [
                    'Excedrin IV Dosing Protocol',
                    'Neuromuscular Blockade Protocol',
                    'Exosome Infusion Therapy',
                    'Standard Stem Cell Intravenous Protocol',
                    'Targeted Spine Joint Prolotherapy',
                    'Regenerative Joint Infiltration',
                    'Myofascial Trigger Point Injection'
                  ]).length === 0 ? (
                    <p className="text-[10px] text-slate-400 p-3 italic">No treatments configured.</p>
                  ) : (
                    (settings.treatments || [
                      'Excedrin IV Dosing Protocol',
                      'Neuromuscular Blockade Protocol',
                      'Exosome Infusion Therapy',
                      'Standard Stem Cell Intravenous Protocol',
                      'Targeted Spine Joint Prolotherapy',
                      'Regenerative Joint Infiltration',
                      'Myofascial Trigger Point Injection'
                    ]).map((t) => (
                      <div key={t} className={`px-3 py-2 flex items-center justify-between text-xs ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <span className={`font-bold truncate pr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={t}>{t}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTreatment(t)}
                          className="text-slate-455 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove option"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {treatmentsOpen && <p className="text-[9px] text-slate-400 font-medium font-sans pt-3">Controls therapeutic options visible on treatment forms.</p>}
        </div>

          </div>
        </div>
      )}

      {activeSegment === 'integration' && (
        <div id="settings_integration_segment_group" className="space-y-6 animate-fade-in duration-300">
          {/* Dossier Data Operations & Integration */}
          <div className={`border rounded-3xl p-6 shadow-sm space-y-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div className={`border-b pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Dossier Data Operations & Cloud Sync
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadCSVTemplate}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                isDark 
                  ? 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-400' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200/60 text-slate-500'
              }`}
              title="Download Excel-compatible template (.csv)"
            >
              <FileDown className="h-3.5 w-3.5" /> Download Template
            </button>
            <button
              onClick={() => {
                setShowImport(!showImport);
                setShowSheetsPortal(false);
                setImportStatus({ type: 'idle', message: '' });
                setParsedPreview([]);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                showImport 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/50' 
                  : (isDark ? 'bg-slate-850 hover:bg-slate-800 border border-slate-755 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-705')
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> {showImport ? 'Close Importer' : 'Import Excel / CSV'}
            </button>
            {userRole === 'admin' && (
              <button
                onClick={() => {
                  setShowSheetsPortal(!showSheetsPortal);
                  setShowImport(false);
                  setSheetsStatus({ type: 'idle', message: '' });
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  showSheetsPortal 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                    : 'bg-emerald-650 border border-transparent text-white hover:bg-emerald-555'
                }`}
              >
                <Cloud className="h-3.5 w-3.5" /> {showSheetsPortal ? 'Close Sheets Sync' : 'Google Sheets Sync'}
              </button>
            )}
          </div>
        </div>



        {showImport && (
          <div className={`border rounded-2xl p-5 space-y-4 animate-fade-in font-sans ${
            isDark ? 'bg-slate-955/50 border-slate-800' : 'bg-slate-50/55 border-slate-200/60'
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

        {showSheetsPortal && userRole === 'admin' && (
          <div className={`border rounded-2xl p-6 space-y-5 animate-fade-in font-sans ${
            isDark ? 'bg-slate-955/50 border-slate-800' : 'bg-slate-50/55 border-slate-200/60'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-emerald-500" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-205' : 'text-slate-800'}`}>
                    Google Sheets Cloud Integration
                  </h4>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-850 border border-emerald-200/30">
                    Active Secure
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Export structured clinical cohorts or import patient records directly from your Google Drive spreadsheets via official Google REST APIs.
                </p>
              </div>
              <button 
                onClick={() => setShowSheetsPortal(false)}
                className="text-slate-450 hover:text-slate-655 cursor-pointer p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Authentication Gateway Selector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 border-t pt-4">
              <div className="lg:col-span-4 space-y-4">
                <div className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-slate-955/40 border-slate-800' : 'bg-slate-50/50 border-slate-200/60'
                } space-y-3`}>
                  <label className={`block text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Authorization Strategy
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('oauth')}
                      className={`w-full py-2 px-3 border rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        authMethod === 'oauth'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                          : isDark ? 'border-slate-800 bg-slate-950/45 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span>1. Single Sign-On (SSO)</span>
                      {authMethod === 'oauth' && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMethod('manual')}
                      className={`w-full py-2 px-3 border rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        authMethod === 'manual'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                          : isDark ? 'border-slate-800 bg-slate-950/45 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span>2. Manual API Token</span>
                      {authMethod === 'manual' && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {authMethod === 'oauth' ? (
                  <div className="space-y-2">
                    {googleUser ? (
                      <div className="space-y-2">
                        <div className={`p-3 rounded-xl flex items-center justify-between text-xs border ${
                          isDark ? 'bg-slate-950/20 border-slate-800 text-slate-350' : 'bg-slate-50 text-slate-700 border-slate-150'
                        }`}>
                          <span className="truncate max-w-[150px] font-bold">{googleUser.email}</span>
                          <button
                            type="button"
                            onClick={handleGoogleLogoutClick}
                            disabled={isSheetsLoading}
                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-600 cursor-pointer"
                          >
                            <LogOut className="h-3 w-3" /> Disconnect
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isSheetsLoading}
                        className={`w-full py-2.5 px-4 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-2 ${
                          isSheetsLoading ? 'bg-slate-400' : 'bg-emerald-650 hover:bg-emerald-555'
                        }`}
                      >
                        <Lock className="h-3.5 w-3.5" /> Authenticate Google
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder="Paste temporary OAuth access token..."
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className={`block w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-650' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleApplyManualToken}
                      className={`w-full py-2 px-3 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer ${activeTheme.primaryBg}`}
                    >
                      Load Custom Token
                    </button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 space-y-4 border-l pl-0 lg:pl-5 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
                {sheetsStatus.type !== 'idle' && (
                  <p className={`text-[10px] font-bold uppercase ${
                    sheetsStatus.type === 'error' ? 'text-rose-500' : sheetsStatus.type === 'success' ? 'text-emerald-600' : 'text-blue-500'
                  }`}>
                    {sheetsStatus.type === 'loading' && '⌛ '} Status: {sheetsStatus.message}
                  </p>
                )}

                <div className="space-y-1.5">
                  <label className={`block text-[9px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Active Spreadsheet Link / Document ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/your-spreadsheet-id"
                      value={spreadsheetIdOrUrl}
                      onChange={(e) => setSpreadsheetIdOrUrl(e.target.value)}
                      className={`block w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isDark ? 'bg-slate-900 border-slate-805 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    />
                    {spreadsheetIdOrUrl && (
                      <a
                        href={spreadsheetIdOrUrl.startsWith('http') ? spreadsheetIdOrUrl : `https://docs.google.com/spreadsheets/d/${spreadsheetIdOrUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`p-2.5 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 ${
                          isDark ? 'border-slate-800 text-slate-330' : 'border-slate-200 text-slate-500'
                        }`}
                        title="Open spreadsheet in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleCreateAndExportSheet}
                    disabled={isSheetsLoading}
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Produce New Sheet
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncToExistingSheet}
                    disabled={isSheetsLoading || !spreadsheetIdOrUrl}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSheetsLoading ? 'animate-spin' : ''}`} /> Push Updates
                  </button>
                  <button
                    type="button"
                    onClick={handleImportFromSheet}
                    disabled={isSheetsLoading || !spreadsheetIdOrUrl}
                    className="py-2.5 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" /> Fetch Sheet Rows
                  </button>
                </div>

                {/* Google Drive Spreadsheet Explorer */}
                <div className="border-t pt-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Cloud className="h-4 w-4 text-sky-450 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest block text-slate-400">
                        📂 Launch EHR Portal directly from Google Drive
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
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 border border-slate-205/10 dark:border-slate-805 rounded-xl p-2 bg-slate-900/30">
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
                              <p className="font-bold truncate text-[11px]">{file.title}</p>
                              <p className="text-[8.5px] font-mono text-slate-500 truncate">ID: {file.id}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
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
                    <p className="text-[10px] text-slate-450 italic px-1">Connect your account above to scan and launch via GDrive files.</p>
                  )}
                </div>

                {createdSheetsList.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Recently Generated Ledgers:</span>
                    <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                      {createdSheetsList.map((sheet) => (
                        <div key={sheet.id} className="flex items-center justify-between gap-2 text-[10px] hover:bg-slate-50/5 p-1 rounded">
                          <button
                            type="button"
                            onClick={() => setSpreadsheetIdOrUrl(sheet.url)}
                            className="text-left font-bold truncate text-slate-600 dark:text-slate-350 hover:underline max-w-[200px]"
                          >
                            &bull; {sheet.title}
                          </button>
                          <a
                            href={sheet.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] font-bold uppercase text-emerald-500 hover:underline shrink-0"
                          >
                            Open Link
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
        </div>
      )}

      {activeSegment === 'printShare' && (
        <div id="settings_print_share_segment_group" className="space-y-6 animate-fade-in duration-300">
          
          {/* Section 1: Print Order Customizer */}
          <div className={`border rounded-3xl p-6 shadow-sm space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center gap-2 border-b pb-3 dark:border-slate-800 border-slate-100/70">
              <Printer className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  Report Document Layout & Section Order
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Configure the presentation sequence of tables and patient records on generated PDF records and print summaries.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Move sections up or down using the arrow buttons to customize their sequence in patient dossier PDFs.
              </p>

              <div className="space-y-2.5 mt-2">
                {printSectionsOrder.map((secId, index) => {
                  const labelDetails = {
                    demographics: {
                      title: 'Core Patient Demographics',
                      desc: 'Full Name, Age, Biological Sex, Contact Phone, and Admission Date',
                      headlineKey: 'headlineDemographics'
                    },
                    parameters: {
                      title: 'Clinical Parameters & Protocols',
                      desc: 'Clinical Diagnosis, Attending Consultant, Active Protocols, and Dosages',
                      headlineKey: 'headlineParameters'
                    },
                    remarks: {
                      title: 'Admitting Practitioner Remarks',
                      desc: 'Initial clinician intake case notes, diagnostics, and admission comments',
                      headlineKey: 'headlineRemarks'
                    },
                    followups: {
                      title: 'Longitudinal Assessment timeline',
                      desc: "Timeline ledger showing any follow-up history logged for this patient",
                      headlineKey: 'headlineFollowUpTitle'
                    },
                    sessions: {
                      title: 'Treatment Sessions Chronology',
                      desc: 'Detailed chronological matrix tracking every active therapy session',
                      headlineKey: 'headlineSessionsTitle'
                    }
                  }[secId as 'demographics' | 'parameters' | 'remarks' | 'followups' | 'sessions'] || {
                    title: secId,
                    desc: 'Custom dossier layout block element',
                    headlineKey: 'headlineAdmission'
                  };

                  const isSectionIncluded = printSectionsIncluded.includes(secId);
                  const currentHeadline = settings[labelDetails.headlineKey as keyof FormSettings] as string || labelDetails.title;

                  return (
                    <div 
                      key={secId}
                      className={`flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-2xl gap-3 transition-all ${
                        isSectionIncluded
                          ? (isDark 
                              ? 'bg-blue-500/5 border-blue-505/20 shadow-xs' 
                              : 'bg-blue-55/15 border-blue-200 shadow-xs')
                          : (isDark 
                              ? 'bg-slate-950/20 border-slate-805 opacity-60' 
                              : 'bg-slate-50/35 border-slate-200/50 opacity-60')
                      }`}
                    >
                      <div className="flex items-start md:items-center gap-3 shrink min-w-0">
                        {/* Checkbox item */}
                        <div className="flex items-center mt-1 md:mt-0 select-none shrink-0">
                          <input
                            type="checkbox"
                            checked={isSectionIncluded}
                            id={`checkbox_print_sec_${secId}`}
                            onChange={() => handleTogglePrintSection(secId)}
                            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                          />
                        </div>

                        {/* Position marker */}
                        <div className={`hidden sm:flex items-center justify-center font-mono text-[10px] font-bold h-6 w-6 rounded-full shrink-0 ${
                          isSectionIncluded
                            ? 'bg-blue-600 text-white'
                            : (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200/50 text-slate-400')
                        }`}>
                          {index + 1}
                        </div>

                        {/* Title and In-place Rename field */}
                        <div className="space-y-1.5 shrink min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'} shrink-0`}>
                              Name/Headline:
                            </span>
                            <input
                              type="text"
                              value={currentHeadline}
                              onChange={(e) => handleUpdateCustomField(labelDetails.headlineKey as keyof FormSettings, e.target.value)}
                              placeholder={labelDetails.title}
                              className={`block w-full max-w-sm px-2.5 py-1.5 border rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                                isDark 
                                  ? 'bg-slate-950 border-slate-805 text-slate-100 hover:border-slate-750' 
                                  : 'bg-white border-slate-200 text-slate-850 hover:border-slate-300'
                              }`}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            {labelDetails.desc}
                          </p>
                        </div>
                      </div>

                      {/* Movement Order Buttons */}
                      <div className="flex items-center gap-1.5 justify-end shrink-0 md:ml-4">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveSection(index, 'up')}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:shadow-xs disabled:opacity-30 disabled:cursor-not-allowed ${
                            isDark 
                              ? 'bg-slate-900 border-slate-805 text-slate-300 hover:bg-slate-800 hover:text-white' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                          }`}
                          title="Move Section Up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === printSectionsOrder.length - 1}
                          onClick={() => handleMoveSection(index, 'down')}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:shadow-xs disabled:opacity-30 disabled:cursor-not-allowed ${
                            isDark 
                              ? 'bg-slate-900 border-slate-805 text-slate-300 hover:bg-slate-800 hover:text-white' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                          }`}
                          title="Move Section Down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>



          {/* Section 3: PDF Header & Footer Layout Components */}
          <div className={`border rounded-3xl p-6 shadow-sm space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center gap-2 border-b pb-3 dark:border-slate-800 border-slate-100/70">
              <Layout className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  PDF Page Header & Footer Components
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Select and toggle which layout modules are printed in the header and footer on generated patient PDFs.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Column 1: Header Elements */}
              <div className="space-y-3.5">
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'} border-b pb-1 dark:border-slate-800 border-slate-100`}>
                  Page Header Components
                </h4>

                <div className="space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.pdfHeaderLogo !== false}
                      onChange={(e) => handleUpdateSetting('pdfHeaderLogo', e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Clinical Organization Logo
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Show the custom uploaded practice branding image at the top left of each page.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.pdfHeaderDocId !== false}
                      onChange={(e) => handleUpdateSetting('pdfHeaderDocId', e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Document Access Identifier ID
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Renders the cryptographically scrambled patient code and record dossier ID.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.pdfHeaderConfidential !== false}
                      onChange={(e) => handleUpdateSetting('pdfHeaderConfidential', e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded text-blue-650 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        "Confidential Record" Label
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Prints a warning notice indicating that the document contains classified medical data.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.pdfHeaderDate !== false}
                      onChange={(e) => handleUpdateSetting('pdfHeaderDate', e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded text-blue-650 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Generation Date & Time Stamp
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Includes the precise dynamic timestamp of when the record PDF dossier was compiled.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Column 2: Footer Elements */}
              <div className="space-y-3.5">
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'} border-b pb-1 dark:border-slate-800 border-slate-100`}>
                  Page Footer Components
                </h4>

                <div className="space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.pdfFooterAddress !== false}
                      onChange={(e) => handleUpdateSetting('pdfFooterAddress', e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Corporate Location Details & Contacts
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Show company physical address, emails, and primary contact lines in footers.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.pdfFooterWatermark !== false}
                      onChange={(e) => handleUpdateSetting('pdfFooterWatermark', e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Sealed Record Authenticity Note
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Prints a security watermark block confirming zero-knowledge local client-side seal.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.pdfFooterPageNumber !== false}
                      onChange={(e) => handleUpdateSetting('pdfFooterPageNumber', e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded text-blue-650 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Dynamic Page Numbers
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Prints a "Page X of Y" counter on the bottom-right corner of all generated pages.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.pdfFooterSignature === true}
                      onChange={(e) => handleUpdateSetting('pdfFooterSignature', e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded text-blue-650 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Seal & Authorized Clinician Signature Line
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Creates an explicit signature line on all page footers for clinician endorsements.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSegment === 'userDetails' && (
        <div id="settings_user_details_segment_group" className="space-y-6 animate-fade-in duration-300">
          <form onSubmit={handleSaveProfile} className={`border rounded-3xl p-6 shadow-sm space-y-6 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center justify-between border-b pb-3.5 dark:border-slate-800 border-slate-100/70">
              <div className="flex items-center gap-2">
                <User className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    Active Clinician Profile Details
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Customize display credentials, roles, identifiers, and department metadata.</p>
                </div>
              </div>
              <span className={`inline-flex items-center text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                userRole === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                userRole === 'co-admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                'bg-slate-500/15 text-slate-500 border border-slate-500/10'
              }`}>
                Privilege: {userRole || 'User'}
              </span>
            </div>

            {/* Success and Error Banners */}
            {profileSuccessMessage && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl text-[11px] font-bold bg-green-500/10 text-green-500 border border-green-505/20">
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{profileSuccessMessage}</span>
              </div>
            )}

            {profileErrorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-505/20">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{profileErrorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Field 1: Display Name */}
              <div>
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                  Clinician Display Name <span className="text-red-550">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileFullName}
                  onChange={(e) => setProfileFullName(e.target.value)}
                  placeholder="Dr. Arthur Pendelton"
                  className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                    isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                  }`}
                />
              </div>

              {/* Field 2: Email ID */}
              <div>
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="arthur.pendelton@hospital.org"
                  className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                    isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                  }`}
                />
              </div>

              {/* Field 3: Age */}
              <div>
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                  Age
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={profileAge}
                  onChange={(e) => setProfileAge(e.target.value)}
                  placeholder="42"
                  className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                    isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                  }`}
                />
              </div>

              {/* Field 4: Sex */}
              <div>
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                  Sex
                </label>
                <select
                  value={profileSex}
                  onChange={(e) => setProfileSex(e.target.value)}
                  className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                    isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                  }`}
                >
                  <option value="">Unspecified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Field 5: Employee ID */}
              <div>
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                  Employee Identifier ID
                </label>
                <input
                  type="text"
                  value={profileEmployeeId}
                  onChange={(e) => setProfileEmployeeId(e.target.value)}
                  placeholder="EMP-94285-MED"
                  className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                    isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                  }`}
                />
              </div>

              {/* Field 6: Designation */}
              <div>
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                  Professional Designation
                </label>
                <input
                  type="text"
                  value={profileDesignation}
                  onChange={(e) => setProfileDesignation(e.target.value)}
                  placeholder="Senior Medical Consultant"
                  className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                    isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                  }`}
                />
              </div>

              {/* Field 7: Phone Number */}
              <div>
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                  Phone Number
                </label>
                <input
                  type="text"
                  value={profilePhoneNumber}
                  onChange={(e) => setProfilePhoneNumber(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                    isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                  }`}
                />
              </div>

              {/* Field 8: Department / Specialty */}
              <div>
                <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                  Clinical Department / Specialty
                </label>
                <input
                  type="text"
                  value={profileDepartment}
                  onChange={(e) => setProfileDepartment(e.target.value)}
                  placeholder="Cardiology & Intensive Care"
                  className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                    isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-slate-800 border-slate-100/70">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center gap-1.5 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 select-none shadow-sm shadow-blue-500/10"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Synchronizing Profile...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Profile Details
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Master Password Change Card */}
          <div className={`border rounded-3xl p-6 shadow-sm space-y-6 ${
            isDark ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center gap-2 border-b pb-3 dark:border-slate-800 border-slate-100/70">
              <Key className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
              <div>
                <h3 id="change_password_section_title" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  Rotate Master Cryptographic Key
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Safely rotate your clinician credentials and re-seal local clinical database files under a new passphrase.</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordSuccessMessage && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs font-semibold text-emerald-400">
                  {passwordSuccessMessage}
                </div>
              )}
              
              {passwordErrorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-xs font-semibold text-rose-400">
                  {passwordErrorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Current Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordOld}
                    onChange={(e) => setPasswordOld(e.target.value)}
                    placeholder="••••••••"
                    className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                      isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    New Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordNew}
                    onChange={(e) => setPasswordNew(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                      isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    className={`block w-full px-3 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-505 ${
                      isDark ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50/50 border-slate-205 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t dark:border-slate-800 border-slate-100/70">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="inline-flex items-center gap-1.5 px-6 py-3 bg-slate-800 hover:bg-slate-750 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 select-none shadow-sm"
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Rotating Master Credentials...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Change Master Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeSegment === 'users' && (
        <div id="settings_users_segment_group" className="space-y-6 animate-fade-in duration-300">
          {userRole === 'admin' && (
            <div className={`border rounded-3xl p-6 shadow-sm space-y-4 ${
          isDark ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-2 border-b pb-3 dark:border-slate-800 border-slate-100/70">
            <ShieldCheck className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Clinician Privileges & Administrative Command
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Assign, promote, and manage practitioner security roles within your secure clinical ledger.</p>
            </div>
          </div>

          {/* Administrative Join Gatekeeper Policy Segment */}
          <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            settings.disableAdminJoining
              ? (isDark ? 'bg-amber-500/5 border-amber-900/30' : 'bg-amber-50/35 border-amber-200/70')
              : (isDark ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-200/60')
          }`}>
            <div className="space-y-1">
              <h4 className={`text-xs font-extrabold uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-slate-800'}`}>
                Administrative Join Gatekeeper
              </h4>
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                When switched on, further people can not join as admin during registration. Clinicians will register as Standard Users and need explicit permission from you (Pending Approval) before they can access the records.
              </p>
            </div>
            
            <button
              type="button"
              id="turn_off_to_join_as_admin_button"
              onClick={() => {
                const updated = {
                  ...settings,
                  disableAdminJoining: !settings.disableAdminJoining
                };
                onUpdateSettings(updated);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border shadow-xs inline-flex items-center gap-2.5 shrink-0 ${
                settings.disableAdminJoining 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' 
                  : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-755' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200')
              }`}
            >
              <span>{settings.disableAdminJoining ? "Turn off to join as admin: ON" : "Turn off to join as admin: OFF"}</span>
              <span className={`w-2.5 h-2.5 rounded-full ${settings.disableAdminJoining ? 'bg-white animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
            </button>
          </div>

          {isUsersLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-4">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              <span>Fetching secure clinician catalog...</span>
            </div>
          ) : Object.keys(dbUsers).length === 0 ? (
            <p className="text-xs text-slate-400 italic p-4">No registered clinicians detected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b dark:border-slate-800 border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Full Name & Title</th>
                    <th className="py-2.5 px-3">Username / ID</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Assigned Privilege</th>
                    <th className="py-2.5 px-3">Access Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800 divide-slate-100">
                  {Object.entries(dbUsers).map(([key, record]: [string, any]) => {
                    const isSelf = key.toLowerCase() === username?.toLowerCase();
                    const statusVal = record.approval || (record.role === 'admin' ? 'approved' : 'pending');
                    return (
                      <tr key={key} className={`text-xs ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'}`}>
                        <td className="py-3.5 px-3">
                          <span className={`font-bold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {record.fullName || 'Unspecified'} {isSelf && <span className="text-[9px] bg-blue-500/10 text-blue-500 px-1.5 py-0.25 rounded font-black tracking-normal uppercase ml-1.5 font-sans">You</span>}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[10px] text-slate-400">{key}</td>
                        <td className="py-3.5 px-3 text-slate-500 font-medium">{record.specialty || 'General Practitioner'}</td>
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            record.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            record.role === 'co-admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            'bg-slate-500/15 text-slate-500 border border-slate-500/10'
                          }`}>
                            {record.role || 'user'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            record.role === 'admin' || statusVal === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            statusVal === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}>
                            {record.role === 'admin' || statusVal === 'approved' ? 'Approved' :
                             statusVal === 'rejected' ? 'Suspended' : 'Pending Approval'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={record.role || 'user'}
                              disabled={isSelf}
                              onChange={(e) => handleUpdateUserRole(key, e.target.value as any)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold border focus:outline-none cursor-pointer disabled:opacity-40 select-none ${
                                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-250 text-slate-700'
                              }`}
                            >
                              <option value="admin">Admin</option>
                              <option value="co-admin">Co-Admin</option>
                              <option value="user">User</option>
                            </select>

                            <select
                              value={statusVal}
                              disabled={isSelf || record.role === 'admin'}
                              onChange={(e) => handleUpdateUserApproval(key, e.target.value as any)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold border focus:outline-none cursor-pointer disabled:opacity-40 select-none ${
                                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-250 text-slate-700'
                              }`}
                            >
                              <option value="approved">Approve Access</option>
                              <option value="pending">Mark Pending</option>
                              <option value="rejected">Suspend/Reject</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSegment === 'auditLogs' && (
        <div id="settings_auditlogs_segment_group" className="space-y-6 animate-fade-in duration-300 font-sans">
          {/* EHR Forensic Backup Verification Check */}
          <div className={`border rounded-3xl p-6 shadow-sm space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 dark:border-slate-800 border-slate-100/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    Cryptographic Backup Signing & Verification
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Generate fully signed database backups, or upload backup profiles to verify their cryptographic signature.</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-550 transition-colors cursor-pointer shadow-sm border border-transparent"
              >
                <Download className="h-3.5 w-3.5" /> Sign & Export Backup
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Drop/Upload files */}
              <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors relative cursor-pointer ${
                isDark ? 'border-slate-800 hover:border-blue-400 bg-slate-950/40' : 'border-slate-250 hover:border-blue-400 bg-white'
              }`}>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleVerifyBackupFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-slate-450" />
                  <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-650'}`}>Drag & Drop Backup JSON or click to browse</p>
                  <p className="text-[10px] text-slate-400 font-mono">Accepts signed .json files only</p>
                </div>
              </div>

              {/* Verify progress / status updates */}
              <div className={`rounded-2xl border p-5 flex flex-col justify-between ${
                isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200/50'
              }`}>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Signature Diagnostics</p>
                  
                  {verifyStatus.type === 'idle' && (
                    <p className="text-xs text-slate-400 italic">No verification file uploaded yet. Awaiting backup file drops...</p>
                  )}
                  {verifyStatus.type === 'loading' && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                      <span>{verifyStatus.message}</span>
                    </div>
                  )}
                  {verifyStatus.type === 'error' && (
                    <div className="p-3 border rounded-xl bg-rose-50/80 text-rose-800 border-rose-100/50 text-xs">
                      <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-rose-700">
                        <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" /> Integrity Breached
                      </p>
                      <p className="mt-1 font-semibold leading-normal">{verifyStatus.message}</p>
                    </div>
                  )}
                  {verifyStatus.type === 'success' && (
                    <div className="p-3 border rounded-xl bg-emerald-50/80 text-emerald-800 border-emerald-100/50 text-xs text-left">
                      <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-emerald-700">
                        <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" /> Certified Cryptographic Match
                      </p>
                      <p className="mt-1 font-semibold leading-normal">{verifyStatus.message}</p>
                    </div>
                  )}
                </div>

                {verifiedBackupData && (
                  <button
                    type="button"
                    onClick={handleRestoreBackup}
                    className="w-full mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-555 transition-colors cursor-pointer shadow-sm animate-pulse border border-transparent"
                  >
                    <CheckSquare className="h-4 w-4" /> Restore Verified Database
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Secure EHR Forensic Audit Logs Tracker */}
          <div className={`border rounded-3xl p-6 shadow-sm space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 dark:border-slate-800 border-slate-100/70">
              <div className="flex items-center gap-2">
                <History className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    EHR Compliance & Audit Trail Tracker
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Real-time unmodifiable logging of clinical actions, syncs, user authentications, and records alterations.</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search logs..."
                    className={`pl-8.5 pr-3 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-250 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-850 placeholder-slate-450'
                    }`}
                  />
                </div>

                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border focus:outline-none cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-250' : 'bg-white border-slate-200 text-slate-705'
                  }`}
                >
                  <option value="all">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warn">Warnings</option>
                  <option value="error">Errors</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setLogsLoading(true);
                    fetch('/api/logs')
                      .then(res => res.json())
                      .then(data => { if (Array.isArray(data)) setLogs(data); setLogsLoading(false); })
                      .catch(() => setLogsLoading(false));
                  }}
                  className={`p-2 rounded-xl border hover:opacity-95 transition-all cursor-pointer ${
                    isDark ? 'bg-slate-955 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Reload audit records"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin text-blue-500' : 'text-slate-400'}`} />
                </button>
              </div>
            </div>

            {/* Logs list rendered */}
            {logsLoading ? (
              <div className="flex items-center justify-center p-12 text-xs text-slate-400 gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                <span>Decrypting secure audits database...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-xs text-slate-400 italic font-medium font-sans">No auditable actions tracked in session.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className={`max-h-[420px] overflow-y-auto border rounded-2xl divide-y ${
                  isDark ? 'border-slate-800/80 bg-slate-950/30 divide-slate-800/60' : 'border-slate-100 bg-white divide-slate-100'
                }`}>
                  {logs
                    .filter(log => {
                      const matchesQuery = !filterQuery || 
                        log.username?.toLowerCase().includes(filterQuery.toLowerCase()) ||
                        log.action?.toLowerCase().includes(filterQuery.toLowerCase()) ||
                        log.details?.toLowerCase().includes(filterQuery.toLowerCase());
                      const matchesSeverity = filterSeverity === 'all' || log.severity === filterSeverity;
                      return matchesQuery && matchesSeverity;
                    })
                    .map((log) => {
                      return (
                        <div key={log.id} className={`p-4 text-xs flex items-start justify-between gap-5 transition-colors ${
                          isDark ? 'hover:bg-slate-900/30' : 'hover:bg-slate-50/40'
                        }`}>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full border ${
                                log.severity === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                log.severity === 'warn' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                                {log.action}
                              </span>
                              
                              <span className={`font-mono text-[10px] font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                u/{log.username}
                              </span>
                              
                              <span className="text-[10px] text-slate-450 font-medium">
                                &middot; {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className={`text-[11px] font-semibold leading-relaxed break-words ${
                              isDark ? 'text-slate-350' : 'text-slate-650'
                            }`}>
                              {log.details}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSegment === 'adminAuditLog' && (
        <div id="settings_admin_auditlog_segment_group" className="space-y-6 animate-fade-in duration-300 font-sans">
          
          <div className={`border rounded-3xl p-6 shadow-xs space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 dark:border-slate-800 border-slate-100/70">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl bg-orange-500/10 text-orange-500`}>
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    Clinical & Audit Trail Ledger
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Simplified audit log tracking high-impact patient deletions, edits and metadata modifications based on editor authorship values.
                  </p>
                </div>
              </div>

              {/* Filters & Export controls */}
              <div className="flex items-center gap-2 flex-wrap sm:self-end">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search ledger..."
                    className={`pl-8.5 pr-3 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-44 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-250 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-850 placeholder-slate-450'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const filteredLogs = logs.filter(log => {
                      const matchesAction = ['PATIENT_DELETE', 'PATIENT_UPDATE', 'PATIENT_CREATE'].includes(log.action);
                      return matchesAction;
                    });
                    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
                      JSON.stringify(filteredLogs, null, 2)
                    )}`;
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute('href', jsonString);
                    downloadAnchor.setAttribute('download', `EHR_Audit_Trail_${new Date().toISOString().split('T')[0]}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  className={`px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl border hover:opacity-90 transition-all cursor-pointer ${
                    isDark ? 'bg-slate-955 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                  }`}
                  title="Export audit trail in compliance JSON structure"
                >
                  <Download className="h-3.5 w-3.5" /> Export Audit Trail
                </button>
              </div>
            </div>

            {/* Quick Stats Banner based on lastEditedBy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2">
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-955 border-slate-805/60' : 'bg-slate-50/40 border-slate-100'}`}>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Deletions Conducted</span>
                <span className="block text-xl font-black mt-1 text-rose-500 font-mono">
                  {logs.filter(l => l.action === 'PATIENT_DELETE').length}
                </span>
                <span className="block text-[8px] text-slate-500 mt-0.5">Irreversible removal logs retained</span>
              </div>
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-955 border-slate-805/60' : 'bg-slate-50/40 border-slate-100'}`}>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Major Record Updates</span>
                <span className="block text-xl font-black mt-1 text-amber-500 font-mono">
                  {logs.filter(l => l.action === 'PATIENT_UPDATE').length}
                </span>
                <span className="block text-[8px] text-slate-500 mt-0.5">State adjustments saved</span>
              </div>
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-955 border-slate-805/60' : 'bg-slate-50/40 border-slate-100'}`}>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Clinical Authors Listed</span>
                <span className="block text-xl font-black mt-1 text-blue-500 font-mono">
                  {new Set(logs.filter(l => ['PATIENT_DELETE', 'PATIENT_UPDATE'].includes(l.action)).map(l => l.username)).size}
                </span>
                <span className="block text-[8px] text-slate-500 mt-0.5">Distinct editors authenticated</span>
              </div>
            </div>

            {/* Action List Section */}
            {logsLoading ? (
              <div className="flex items-center justify-center p-12 text-xs text-slate-400 gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                <span>Consolidation of simplified clinician actions...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-2xl border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-400 italic font-medium">No actions retrieved in audit log database.</p>
              </div>
            ) : (
              <div className="overflow-hidden border rounded-2xl dark:border-slate-800/80 border-slate-100">
                <div className={`divide-y max-h-[500px] overflow-y-auto ${
                  isDark ? 'divide-slate-850 bg-slate-950/5' : 'divide-slate-100 bg-white'
                }`}>
                  {(() => {
                    const relevantActions = ['PATIENT_DELETE', 'PATIENT_UPDATE', 'PATIENT_CREATE'];
                    const filteredList = logs
                      .filter(log => relevantActions.includes(log.action))
                      .filter(log => {
                        const matchesQuery = !filterQuery || 
                          log.username?.toLowerCase().includes(filterQuery.toLowerCase()) ||
                          log.action?.toLowerCase().includes(filterQuery.toLowerCase()) ||
                          log.details?.toLowerCase().includes(filterQuery.toLowerCase());
                        return matchesQuery;
                      });

                    if (filteredList.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-slate-400 italic font-medium">
                          No matching clinician record updates or patient deletions found.
                        </div>
                      );
                    }

                    return filteredList.map((log) => {
                      const normalizedUser = log.username?.toLowerCase().trim() || '';
                      const clinicalProfile = dbUsers[normalizedUser] || Object.values(dbUsers).find(
                        (u: any) => u.username?.toLowerCase().trim() === normalizedUser || u.fullName?.toLowerCase().trim() === normalizedUser
                      );

                      const actorName = clinicalProfile?.fullName || log.username || 'System Admin';
                      const actorDesignation = clinicalProfile?.designation || (log.username === 'system' ? 'Automated Engine' : 'Partner Provider');
                      const actorRole = clinicalProfile?.role || (log.username === 'system' ? 'system' : 'clinician');

                      return (
                        <div key={log.id} className={`p-4 text-xs transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isDark ? 'hover:bg-slate-900/30' : 'hover:bg-slate-50/40'
                        }`}>
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <div className="mt-1.5 shrink-0">
                              <span className={`w-2.5 h-2.5 rounded-full block ${
                                log.action === 'PATIENT_DELETE' ? 'bg-rose-500 ring-4 ring-rose-500/10' :
                                log.action === 'PATIENT_UPDATE' ? 'bg-amber-500 ring-4 ring-amber-500/10' :
                                'bg-emerald-500 ring-4 ring-emerald-500/10'
                              }`} />
                            </div>

                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-black uppercase tracking-wider text-[9px] px-2 py-0.5 rounded-md border ${
                                  log.action === 'PATIENT_DELETE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                  log.action === 'PATIENT_UPDATE' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {log.action === 'PATIENT_DELETE' ? 'Patient Deleted' :
                                   log.action === 'PATIENT_UPDATE' ? 'Record Edited' :
                                   'Patient Created'}
                                </span>

                                <span className={`font-mono text-[10px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                  {normalizedUser === 'system' ? 'system' : `u/${normalizedUser}`}
                                </span>

                                <span className="text-[10px] text-slate-450 font-medium">
                                  &middot; {new Date(log.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              </div>

                              <p className={`text-[11px] font-semibold leading-relaxed break-words pr-2 ${
                                isDark ? 'text-slate-350' : 'text-slate-650'
                              }`}>
                                {log.details}
                              </p>
                            </div>
                          </div>

                          <div className={`shrink-0 flex items-center gap-2.5 p-2 rounded-xl border text-right justify-end md:w-56 ${
                            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/50 border-slate-150'
                          }`}>
                            <div className="min-w-0">
                              <span className={`block text-[10px] font-extrabold uppercase tracking-wide truncate ${isDark ? 'text-slate-200' : 'text-slate-850'}`}>
                                {actorName}
                              </span>
                              <span className="block text-[9px] text-slate-400 truncate font-semibold">
                                {actorDesignation}
                              </span>
                            </div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                              actorRole === 'admin' ? 'bg-red-500/10 text-red-500' :
                              actorRole === 'co-admin' ? 'bg-blue-500/10 text-blue-500' :
                              'bg-slate-500/10 text-slate-500'
                            }`} title={`Role: ${actorRole}`}>
                              {actorName.charAt(0)}
                            </div>
                          </div>

                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

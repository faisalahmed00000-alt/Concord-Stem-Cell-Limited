import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Activity, 
  Users, 
  UserPlus, 
  ClipboardCheck, 
  BadgeHelp, 
  Lock, 
  Sparkles, 
  Compass, 
  ShieldCheck, 
  LogOut,
  CalendarDays,
  History,
  Menu,
  Home,
  MessageCircle,
  Clapperboard,
  Store,
  Bell
} from 'lucide-react';
import { Patient, FollowUp } from './types/patient';
import { encrypt, decrypt, deriveKey } from './utils/crypto';
import { secureStorage } from './utils/storage';
import LoginForm from './components/LoginForm';
import PatientForm from './components/PatientForm';
import FollowUpForm from './components/FollowUpForm';
import PatientList from './components/PatientList';
import DashboardCharts from './components/DashboardCharts';
import SettingsPanel from './components/SettingsPanel';
import DailyDigestNotification from './components/DailyDigestNotification';
import { FormSettings, THEME_OPTIONS, ThemeOption, BG_COLOR_OPTIONS } from './types/settings';
import { 
  Settings as SettingsIcon,
  Palette, 
  Sliders, 
  Stethoscope, 
  Cloud, 
  Printer, 
  User,
  Monitor
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<{ 
    username: string; 
    key: any; 
    role: 'admin' | 'co-admin' | 'user';
    fullName: string;
    email?: string;
    age?: number;
    sex?: string;
    employeeId?: string;
    designation?: string;
    specialty?: string;
    phoneNumber?: string;
    department?: string;
  } | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activeTab, setActiveTab] = useState<'directory' | 'admit' | 'followup' | 'analytics' | 'settings'>('directory');
  const [activeSegment, setActiveSegment] = useState<'aesthetics' | 'formKeys' | 'registries' | 'integration' | 'users' | 'printShare' | 'userDetails' | 'adminAuditLog'>('aesthetics');
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [dbUsers, setDbUsers] = useState<Record<string, any>>({});
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [screenSize, setScreenSize] = useState({ width: 1440, height: 900, desc: 'Large Screen (lg)' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      let desc = 'Mobile Port (xs)';
      if (w >= 1536) desc = 'Wide Dynamic Monitor (2xl)';
      else if (w >= 1280) desc = 'Desktop Workspace (xl)';
      else if (w >= 1024) desc = 'Standard Desktop (lg)';
      else if (w >= 768) desc = 'Clinic Tablet (md)';
      else if (w >= 640) desc = 'Mobile Land (sm)';
      
      setScreenSize({ width: w, height: h, desc });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto scroll to top of window and scrollable panel containers when activeTab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const cols = document.querySelectorAll('.overflow-y-auto, main');
    cols.forEach((col) => {
      col.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [activeTab]);

  // Persistent Autologin on Device load
  useEffect(() => {
    const autoAuthenticate = async () => {
      const activeSessionRaw = secureStorage.getItem('secure_ledger_active_session');
      if (!activeSessionRaw) return;

      try {
        const { username, rawPassword } = JSON.parse(activeSessionRaw);
        if (!username || !rawPassword) return;

        // Fetch users from server
        const res = await fetch('/api/users');
        const users = res.ok ? await res.json() : {};

        // Find matching record
        const lowerUser = username.toLowerCase().trim();
        let userRecord = users[lowerUser];
        
        // Fallback search if username is stored as fullName in activeSession
        if (!userRecord) {
          const matchingKey = Object.keys(users).find(
            u => users[u].fullName === username || u === username.toLowerCase().trim()
          );
          if (matchingKey) {
            userRecord = users[matchingKey];
          }
        }

        if (userRecord) {
          const key = await deriveKey(rawPassword, userRecord.salt);
          await handleLoginSuccess(userRecord.username, key, rawPassword);
        }
      } catch (e) {
        console.error('Auto login restoration failed', e);
      }
    };
    autoAuthenticate();
  }, []);

  // Fetch server settings on initial load
  useEffect(() => {
    const loadServerSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const serverSettings = await res.json();
          setSettings(serverSettings);
          secureStorage.setItem('secure_ledger_settings', JSON.stringify(serverSettings));
        }
      } catch (e) {
        console.error('Failed to load server settings', e);
      }
    };
    loadServerSettings();
  }, []);

  // Sync patients when logged in and tab switches (real-time data for multi-user!)
  useEffect(() => {
    if (!session) return;
    const syncPatients = async () => {
      try {
        const res = await fetch('/api/patients');
        if (res.ok) {
          const serverPatients = await res.json();
          setPatients(serverPatients);
        }
      } catch (e) {
        console.error('Failed to sync patients from server', e);
      }
    };
    syncPatients();
  }, [activeTab, session]);

  // Fetch users mapped key-value for name lookups
  useEffect(() => {
    if (!session) return;
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          setDbUsers(await res.json());
        }
      } catch (e) {
        console.error('Failed to load user database', e);
      }
    };
    fetchUsers();
  }, [session, activeTab]);

  // Enforce standard user setting segment lock to 'userDetails'
  useEffect(() => {
    if (session?.role === 'user' && activeSegment !== 'userDetails') {
      setActiveSegment('userDetails');
    }
  }, [session?.role, activeSegment]);

  // Settings State matching encryption schema
  const [settings, setSettings] = useState<FormSettings>(() => {
    const raw = secureStorage.getItem('secure_ledger_settings');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return {
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
  });

  const handleUpdateSettings = async (newSettings: FormSettings) => {
    setSettings(newSettings);
    secureStorage.setItem('secure_ledger_settings', JSON.stringify(newSettings));
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    } catch (e) {
      console.error('Failed to sync settings with server', e);
    }
  };

  const activeTheme = THEME_OPTIONS.find(t => t.id === settings.theme) || THEME_OPTIONS[0];

  // Update singular Patient state (e.g. for uploads or attachment deletion)
  const handleUpdatePatient = async (updatedPatient: Patient) => {
    if (!session) return;
    const authorName = session.username;
    const patientWithAudit = {
      ...updatedPatient,
      lastEditedBy: authorName
    };
    const updatedPatients = patients.map(p => p.id === updatedPatient.id ? patientWithAudit : p);
    setPatients(updatedPatients);
    await encryptAndPersistPatients(updatedPatients, session.key);
  };

  // Authenticate user session
  const handleLoginSuccess = async (username: string, key: any, rawPassword?: string) => {
    setIsLoading(true);
    try {
      // Sync any customized settings (e.g. from registration)
      try {
        const sRes = await fetch('/api/settings');
        if (sRes.ok) {
          const serverSettings = await sRes.json();
          setSettings(serverSettings);
          secureStorage.setItem('secure_ledger_settings', JSON.stringify(serverSettings));
        }
      } catch (e) {}

      // Load patient database from server
      const pRes = await fetch('/api/patients');
      if (pRes.ok) {
        const serverPatients = await pRes.json();
        setPatients(serverPatients);
      } else {
        setPatients([]);
      }

      // Load user database from server to read role and fullName
      let role: 'admin' | 'co-admin' | 'user' = 'user';
      let fullName = username;
      let actualUsername = username;
      let email = '';
      let age = '';
      let sex = '';
      let employeeId = '';
      let designation = '';
      let specialty = '';
      let phoneNumber = '';
      let department = '';

      try {
        const uRes = await fetch('/api/users');
        if (uRes.ok) {
          const users = await uRes.json();
          const lowerUser = username.toLowerCase().trim();
          let userRecord = users[lowerUser];
          if (!userRecord) {
            const matchingKey = Object.keys(users).find(
              u => users[u].fullName === username || u === username.toLowerCase().trim()
            );
            if (matchingKey) {
              userRecord = users[matchingKey];
            }
          }
          if (userRecord) {
            role = userRecord.role || 'user';
            fullName = userRecord.fullName || username;
            actualUsername = userRecord.username || username;
            email = userRecord.email || '';
            age = userRecord.age !== undefined ? userRecord.age : '';
            sex = userRecord.sex || '';
            employeeId = userRecord.employeeId || '';
            designation = userRecord.designation || '';
            specialty = userRecord.specialty || '';
            phoneNumber = userRecord.phoneNumber || '';
            department = userRecord.department || '';
          }
        }
      } catch (e) {
        console.error('Failed to resolve clinician role metadata', e);
      }

      if (rawPassword) {
        secureStorage.setItem('secure_ledger_active_session', JSON.stringify({ username: actualUsername, rawPassword }));
      }

      setSession({ 
        username: actualUsername, 
        key, 
        role, 
        fullName,
        email,
        age: age ? Number(age) : undefined,
        sex,
        employeeId,
        designation,
        specialty,
        phoneNumber,
        department
      });
    } catch (err) {
      console.error('Failed to initialize secure clinical workspace', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Securely logs out
  const handleLogOut = () => {
    secureStorage.removeItem('secure_ledger_active_session');
    setSession(null);
    setPatients([]);
    setActiveTab('directory');
    setPreselectedPatientId(undefined);
  };

  // Encrypt & save patient list helper and sync to server
  const encryptAndPersistPatients = async (updatedPatients: Patient[], key: any) => {
    try {
      // Local storage encrypted backup
      const serialized = JSON.stringify(updatedPatients);
      const encrypted = await encrypt(serialized, key);
      secureStorage.setItem('secure_ledger_patients', JSON.stringify(encrypted));

      // Centralized sync to server
      const editorParam = session ? `?editor=${encodeURIComponent(session.username)}` : '';
      await fetch(`/api/patients/bulk${editorParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPatients)
      });
    } catch (err) {
      console.error('Cryptographic or sync failure during saving records.', err);
    }
  };

  // Add a new patient record
  const handleAddPatient = async (newPatientData: Omit<Patient, 'id' | 'followUps' | 'createdAt'>) => {
    if (!session) return;

    const creatorName = session.username;
    const newPatient: Patient = {
      ...newPatientData,
      id: crypto.randomUUID(),
      followUps: [],
      createdAt: new Date().toISOString(),
      submittedBy: creatorName,
      lastEditedBy: creatorName
    };

    const updatedPatients = [newPatient, ...patients];
    setPatients(updatedPatients);
    await encryptAndPersistPatients(updatedPatients, session.key);
    
    // Auto-navigate to directory to review record
    setActiveTab('directory');
  };

  // Bulk import patient records
  const handleImportPatients = async (importedList: Patient[], overwrite: boolean = false) => {
    if (!session) return;
    const creatorName = session.username;
    const cleanImport = importedList.map(p => ({
      ...p,
      submittedBy: p.submittedBy || creatorName,
      lastEditedBy: p.lastEditedBy || creatorName
    }));
    const updatedPatients = overwrite ? cleanImport : [...cleanImport, ...patients];
    setPatients(updatedPatients);
    await encryptAndPersistPatients(updatedPatients, session.key);

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: creatorName,
          action: 'PATIENT_IMPORT',
          details: `Conducted Bulk Import: Integrated ${importedList.length} patient records (Overwrite mode: ${overwrite ? 'Enabled' : 'Disabled'})`,
          severity: 'info'
        })
      });
    } catch (logErr) {
      console.error('Failed to log bulk import:', logErr);
    }
  };

  // Add follow-up logic
  const handleAddFollowUp = async (patientId: string, followUpData: Omit<FollowUp, 'id'>) => {
    if (!session) return;

    const newFollowUp: FollowUp = {
      ...followUpData,
      clinician: session.username, // Force active clinician attribution
      id: crypto.randomUUID()
    };

    const updatedPatients = patients.map((patient) => {
      if (patient.id === patientId) {
        // Determine the overall last status from the followUp to keep dashboard/cards synchronized
        // Map common phrases if possible
        let rootImprovement = patient.improvement;
        const lowStatus = followUpData.status.toLowerCase();
        if (lowStatus.includes('significantly')) rootImprovement = 'Significantly Improved';
        else if (lowStatus.includes('gradual') || lowStatus.includes('improvement')) rootImprovement = 'Improved';
        else if (lowStatus.includes('stable') || lowStatus.includes('maintenance')) rootImprovement = 'Stable';
        else if (lowStatus.includes('no changes') || lowStatus.includes('plateau') || lowStatus.includes('unchanged')) rootImprovement = 'Unchanged';
        else if (lowStatus.includes('deteriorated') || lowStatus.includes('regression')) rootImprovement = 'Deteriorated';

        return {
          ...patient,
          improvement: rootImprovement,
          sessionNo: followUpData.sessionNo !== undefined ? followUpData.sessionNo : patient.sessionNo,
          followUps: [newFollowUp, ...patient.followUps],
          lastEditedBy: session.username // Record who edited/created this follow-up
        };
      }
      return patient;
    });

    setPatients(updatedPatients);
    await encryptAndPersistPatients(updatedPatients, session.key);

    // Navigate to directory
    setPreselectedPatientId(undefined);
    setActiveTab('directory');
  };

  // Delete/Purge Patient record
  const handleDeletePatient = async (patientId: string) => {
    if (!session) return;
    if (session.role === 'user') {
      alert('Access Denied: Standard users are not permitted to delete patient records.');
      return;
    }

    const confirmPurge = confirm(
      'SECURITY WARNING:\nYou are about to irrevocably purge this patient record and all follow-up consultation timelines from deep storage.\n\nThis cannot be undone. Are you absolutely sure?'
    );

    if (!confirmPurge) return;

    const targetPatient = patients.find((p) => p.id === patientId);
    const updatedPatients = patients.filter((p) => p.id !== patientId);
    setPatients(updatedPatients);
    await encryptAndPersistPatients(updatedPatients, session.key);

    if (targetPatient) {
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: session.username,
            action: 'PATIENT_DELETE',
            details: `Irrevocably deleted Patient Record for ${targetPatient.name} (${targetPatient.code || 'ID: ' + targetPatient.id})`,
            severity: 'warn'
          })
        });
      } catch (logErr) {
        console.error('Failed to log patient delete:', logErr);
      }
    }
  };

  // Quick Action: Route from List to Follow-up Form
  const handleAddFollowUpClick = (patientId: string) => {
    setPreselectedPatientId(patientId);
    setActiveTab('followup');
  };

  // Clear preselected patient helper
  const handleFollowUpCancel = () => {
    setPreselectedPatientId(undefined);
    setActiveTab('directory');
  };

  if (!session) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  const isDark = activeTheme.isDark;
  const selectedBg = BG_COLOR_OPTIONS.find(bg => bg.id === settings.appBgColor) || BG_COLOR_OPTIONS[0];
  const bgClass = isDark ? selectedBg.darkBg : selectedBg.lightBg;

  // Simple check for pending follow-ups or Default to 8 (matching the image exact high fidelity when dataset is clean)
  const outstandingCount = patients.reduce((acc, p) => {
    if (p.requiresFollowUp !== false) {
      if (!p.followUps || p.followUps.length === 0) return acc + 1;
    }
    return acc;
  }, 0) || 8;

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-200 ${bgClass} ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Clinician Interface Header */}
      <header className={`border-b select-none shrink-0 sticky top-0 z-40 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'}`}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {settings.companyLogo ? (
              <img src={settings.companyLogo} alt="Corporate Logo" className="object-contain rounded-xl p-1 bg-white border border-slate-205 shadow-xs w-[80px] h-10" referrerPolicy="no-referrer" />
            ) : (
              <div className={`p-2 rounded-xl text-white shadow-none ${activeTheme.primaryBg}`}>
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
            )}
            <div>
              <h1 
                className={`text-[16px] w-[250px] font-extrabold tracking-tight uppercase ${isDark ? 'text-slate-100' : 'text-slate-850'}`}
                style={{ marginTop: '-3px', width: '250px' }}
              >
                {settings.appName || 'Clinician Portal'}
              </h1>
            </div>
          </div>

          {/* Diagnostic Screen Size Indicator Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-mono font-bold uppercase tracking-wider shadow-xs select-none bg-indigo-500/10 border-indigo-500/15 text-indigo-400">
            <Monitor className="h-4 w-4 shrink-0 text-indigo-500 animate-pulse" />
            <span className="font-extrabold text-[12px] text-slate-400">Screen:</span>
            <span className="font-black text-[12px] text-indigo-400">
              {screenSize.desc}
            </span>
            <span className="text-slate-500 text-[11px] ml-0.5 font-mono">({screenSize.width} × {screenSize.height}px)</span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Logout actions */}
            <button
              id="clinician_logout_btn"
              onClick={handleLogOut}
              className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-750'
              }`}
            >
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Facebook-style Horizontal Tab Navigation Menu Row */}
        <div className={`border-t transition-colors duration-250 ${
          isDark ? 'border-slate-800 bg-slate-950/45' : 'border-slate-100 bg-slate-50/25'
        }`}>
          <div className="max-w-xl mx-auto px-4 flex items-center justify-between">
            {/* Tab 1: Patient Directory */}
            <button
              onClick={() => {
                setActiveTab('directory');
                setPreselectedPatientId(undefined);
              }}
              className={`relative flex items-center justify-center flex-1 py-3 transition-colors duration-150 cursor-pointer focus:outline-none ${
                activeTab === 'directory'
                  ? activeTheme.primaryText
                  : isDark
                    ? 'text-slate-400 hover:text-slate-250'
                    : 'text-slate-500 hover:text-slate-850'
              }`}
              title="Patient Directory"
            >
              <Users className="h-6 w-6" strokeWidth={activeTab === 'directory' ? 2.5 : 2} fill={activeTab === 'directory' ? "currentColor" : "none"} fillOpacity={activeTab === 'directory' ? 0.15 : 0} />
              {activeTab === 'directory' && (
                <span className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${activeTheme.indicatorBg}`} />
              )}
            </button>

            {/* Tab 2: Admit Patient */}
            {session?.role !== 'user' && (
              <button
                onClick={() => {
                  setActiveTab('admit');
                  setPreselectedPatientId(undefined);
                }}
                className={`relative flex items-center justify-center flex-1 py-3 transition-colors duration-150 cursor-pointer focus:outline-none ${
                  activeTab === 'admit'
                    ? activeTheme.primaryText
                    : isDark
                      ? 'text-slate-400 hover:text-slate-250'
                      : 'text-slate-500 hover:text-slate-850'
                }`}
                title="Admit Patient"
              >
                <UserPlus className="h-6 w-6" strokeWidth={activeTab === 'admit' ? 2.5 : 2} fill={activeTab === 'admit' ? "currentColor" : "none"} fillOpacity={activeTab === 'admit' ? 0.15 : 0} />
                {activeTab === 'admit' && (
                  <span className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${activeTheme.indicatorBg}`} />
                )}
              </button>
            )}

            {/* Tab 3: Entry Follow-Ups */}
            <button
              onClick={() => {
                setActiveTab('followup');
              }}
              className={`relative flex items-center justify-center flex-1 py-3 transition-colors duration-150 cursor-pointer focus:outline-none ${
                activeTab === 'followup'
                  ? activeTheme.primaryText
                  : isDark
                    ? 'text-slate-400 hover:text-slate-250'
                    : 'text-slate-500 hover:text-slate-850'
              }`}
              title="Entry Follow-Ups"
            >
              <CalendarDays className="h-6 w-6" strokeWidth={activeTab === 'followup' ? 2.5 : 2} fill={activeTab === 'followup' ? "currentColor" : "none"} fillOpacity={activeTab === 'followup' ? 0.15 : 0} />
              {outstandingCount > 0 && (
                <span className="absolute top-2 right-1/2 translate-x-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#f02849] text-[10px] font-bold text-white shadow-sm leading-none">
                  {outstandingCount}
                </span>
              )}
              {activeTab === 'followup' && (
                <span className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${activeTheme.indicatorBg}`} />
              )}
            </button>

            {/* Tab 4: Analytic Status */}
            <button
              onClick={() => {
                setActiveTab('analytics');
                setPreselectedPatientId(undefined);
              }}
              className={`relative flex items-center justify-center flex-1 py-3 transition-colors duration-150 cursor-pointer focus:outline-none ${
                activeTab === 'analytics'
                  ? activeTheme.primaryText
                  : isDark
                    ? 'text-slate-400 hover:text-slate-250'
                    : 'text-slate-500 hover:text-slate-850'
              }`}
              title="Analytic Dashboard"
            >
              <Activity className="h-6 w-6 animate-pulse" strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
              {activeTab === 'analytics' && (
                <span className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${activeTheme.indicatorBg}`} />
              )}
            </button>

            {/* Tab 5: Bell Icon Dropdown (Clinical Follow-Up Daily Digest) */}
            <div className="flex flex-1 items-center justify-center">
              <DailyDigestNotification 
                patients={patients}
                activeTheme={activeTheme}
                isMenuIcon={true}
                onNavigateToFollowUp={(patientId) => {
                  setPreselectedPatientId(patientId || undefined);
                  setActiveTab('followup');
                }}
              />
            </div>

            {/* Tab 6: Clinical Settings */}
            {session && (
              <div 
                className="relative flex flex-1 items-center justify-center"
                onMouseEnter={() => setShowQuickSettings(true)}
                onMouseLeave={() => setShowQuickSettings(false)}
              >
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setActiveSegment(session?.role === 'user' ? 'userDetails' : 'aesthetics');
                    setPreselectedPatientId(undefined);
                  }}
                  className={`relative flex items-center justify-center w-full py-3 transition-colors duration-150 cursor-pointer focus:outline-none ${
                    activeTab === 'settings'
                      ? activeTheme.primaryText
                      : isDark
                        ? 'text-slate-400 hover:text-slate-250'
                        : 'text-slate-500 hover:text-slate-850'
                  }`}
                  title={session?.role === 'user' ? "My Profile Details" : "Clinical Settings"}
                >
                  <SettingsIcon className="h-6 w-6" strokeWidth={activeTab === 'settings' ? 2.5 : 2} fill={activeTab === 'settings' ? "currentColor" : "none"} fillOpacity={activeTab === 'settings' ? 0.15 : 0} />
                  {session?.role !== 'user' && (
                    <span className="absolute top-2 right-1/2 translate-x-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#f02849] text-[10px] font-bold text-white shadow-sm leading-none">
                      2
                    </span>
                  )}
                  {activeTab === 'settings' && (
                    <span className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${activeTheme.indicatorBg}`} />
                  )}
                </button>

                {/* Quick Settings Console Dropdown Menu */}
                <AnimatePresence>
                  {showQuickSettings && (
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={`absolute right-0 top-full mt-1 w-72 rounded-2xl border p-4 shadow-xl z-50 transition-all text-left ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-slate-950/50' 
                          : 'bg-white border-slate-100 text-slate-900 shadow-slate-200/50'
                      }`}
                    >
                      <div className="border-b pb-2 mb-3 dark:border-slate-800 border-slate-100/80">
                        <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                          <Sparkles className="h-4 w-4 animate-pulse text-blue-500" />
                          Quick Settings Console
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">
                          Jump directly to any other section without scrolling
                        </p>
                      </div>

                      <div className="flex flex-col gap-1">
                        {[
                          { id: 'aesthetics', label: 'Theme', icon: Palette, desc: 'Themes, logo, and active background color style' },
                          { id: 'formKeys', label: 'Form setup', icon: Sliders, desc: 'Form field overrides, admission headers, dynamic tags' },
                          { id: 'registries', label: 'Dropdown Registries', icon: Stethoscope, desc: 'Manage dropdown contents for clinical parameter forms' },
                          { id: 'integration', label: 'Data Sync & Import', icon: Cloud, desc: 'Sync data real-time, import patient list backups, Excel sync' },
                          { id: 'printShare', label: 'Print / Share Setup', icon: Printer, desc: 'Control medical report formatting, anonymisation templates' },
                          { id: 'userDetails', label: 'User Details', icon: User, desc: 'Configure current active clinician card details & photo' },
                          ...(session?.role === 'admin' ? [
                            { id: 'users', label: 'Staff Roster Roles', icon: ShieldCheck, desc: 'Edit practice member logins, credentials, and roles' },
                            { id: 'adminAuditLog', label: 'Admin Audit Log', icon: History, desc: 'Simplified audit log of deletions and edits' }
                          ] : [])
                        ].filter((sec) => session?.role !== 'user' || sec.id === 'userDetails').map((section) => {
                          const IconComp = section.icon;
                          const isCurrent = activeTab === 'settings' && activeSegment === section.id;
                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => {
                                setActiveTab('settings');
                                setActiveSegment(section.id as any);
                                setShowQuickSettings(false);
                              }}
                              className={`w-full text-left flex items-start gap-2.5 p-2 rounded-xl transition-all hover:translate-x-0.5 cursor-pointer ${
                                isCurrent
                                  ? `${activeTheme.accentBg} ${activeTheme.primaryText} font-bold`
                                  : isDark
                                    ? 'hover:bg-slate-850 text-slate-300 hover:text-white'
                                    : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
                              }`}
                            >
                              <IconComp className={`h-4 w-4 mt-0.5 shrink-0 ${isCurrent ? activeTheme.primaryText : 'text-slate-400'}`} />
                              <div>
                                <span className="block text-[10px] font-black uppercase tracking-wider leading-none">
                                  {section.label}
                                </span>
                                <span className="block text-[9px] text-slate-400 mt-1 max-w-[200px] leading-tight font-medium">
                                  {section.desc}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col relative">
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        {isLoading ? (
          <div className="h-64 flex flex-col justify-center items-center gap-3">
            <svg className="animate-spin h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Decrypting clinical ledger state securely...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {activeTab === 'directory' && (
                <motion.div
                  key="directory"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  <PatientList 
                    patients={patients} 
                    onAddFollowUpClick={handleAddFollowUpClick} 
                    onDeletePatient={handleDeletePatient} 
                    onImportPatients={handleImportPatients}
                    onUpdatePatient={handleUpdatePatient}
                    settings={settings}
                    activeTheme={activeTheme}
                    onUpdateSettings={handleUpdateSettings}
                    userRole={session?.role}
                    dbUsers={dbUsers}
                  />
                </motion.div>
              )}

              {activeTab === 'admit' && (
                <motion.div
                  key="admit"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.18 }}
                  className="max-w-3xl mx-auto"
                >
                  <PatientForm 
                    onAddPatient={handleAddPatient} 
                    onCancel={() => setActiveTab('directory')} 
                    settings={settings}
                    activeTheme={activeTheme}
                    onUpdateSettings={handleUpdateSettings}
                  />
                </motion.div>
              )}

              {activeTab === 'followup' && (
                <motion.div
                  key="followup"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.18 }}
                  className="max-w-xl mx-auto"
                >
                  <FollowUpForm 
                    patients={patients} 
                    preselectedPatientId={preselectedPatientId} 
                    onAddFollowUp={handleAddFollowUp} 
                    onCancel={handleFollowUpCancel} 
                    settings={settings}
                    activeTheme={activeTheme}
                    onUpdateSettings={handleUpdateSettings}
                    onUpdatePatient={handleUpdatePatient}
                    userRole={session?.role}
                  />
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  <DashboardCharts patients={patients} isDark={isDark} activeTheme={activeTheme} />
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  <SettingsPanel 
                    settings={settings} 
                    onUpdateSettings={handleUpdateSettings} 
                    patients={patients}
                    onImportPatients={handleImportPatients}
                    userRole={session?.role}
                    username={session?.username}
                    fullName={session?.fullName || session?.username}
                    session={session}
                    onUpdateSession={(updatedFields: any) => setSession(prev => prev ? { ...prev, ...updatedFields } : null)}
                    activeSegment={activeSegment}
                    onActiveSegmentChange={setActiveSegment}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>

      {/* Zero Knowledge Privacy Indicator Footer */}
      <footer className={`border-t select-none shrink-0 py-4.5 text-center transition-colors duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-400'
      }`}>
        <div className="max-w-[1600px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-slate-400 gap-2">
          <div className={`flex items-center gap-1.5 text-[9px] px-3 py-1 rounded-full font-mono font-bold uppercase tracking-wider border ${
            isDark ? 'bg-slate-955 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200/60 text-slate-500'
          }`}>
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            <span>Strict Client-Side AES-GCM Encrypted Data Model</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

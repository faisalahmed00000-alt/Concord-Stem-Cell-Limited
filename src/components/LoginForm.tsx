import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, LogIn, UserPlus, Sliders, Image, FileText, ChevronDown, ChevronUp, Sparkles, ArrowRight, ArrowLeft, Check, Award, AlertCircle, Server } from 'lucide-react';
import { deriveKey, hashPassword, generateSalt, encrypt, decrypt } from '../utils/crypto';
import { secureStorage } from '../utils/storage';
import { BG_COLOR_OPTIONS } from '../types/settings';

interface LoginFormProps {
  onLoginSuccess: (username: string, key: any, rawPassword?: string) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDetais, setShowDetails] = useState(false);
  const [regRole, setRegRole] = useState<'admin' | 'user'>('admin');

  // Automated setup wizard trigger states
  const [isAdminPresent, setIsAdminPresent] = useState<boolean | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  React.useEffect(() => {
    const checkAdminPresence = async () => {
      try {
        const res = await fetch('/api/check-admin-exists');
        if (res.ok) {
          const data = await res.json();
          setIsAdminPresent(data.exists);
        }
      } catch (e) {
        console.error('Failed to verify active admin presence:', e);
      }
    };
    checkAdminPresence();
  }, []);

  // Load app settings to enforce administrative registration lock
  const [settings, setSettings] = useState<any>(() => {
    try {
      const raw = secureStorage.getItem('secure_ledger_settings');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const latestSettings = await res.json();
          setSettings(latestSettings);
          secureStorage.setItem('secure_ledger_settings', JSON.stringify(latestSettings));
        }
      } catch (e) {
        console.error('Failed to load settings in LoginForm:', e);
      }
    };
    fetchSettings();
  }, []);

  const isAdminJoiningDisabled = !!settings?.disableAdminJoining;

  React.useEffect(() => {
    if (isAdminJoiningDisabled) {
      setRegRole('user');
    }
  }, [isAdminJoiningDisabled]);


  // Recovery Questions & Answers state
  const [securityQuestion, setSecurityQuestion] = useState('What was the name of your first clinical facility?');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveryHint, setRecoveryHint] = useState('');

  // Password Recovery workflow states
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1); // 1 = username entry, 2 = security question verification
  const [recoveryUserRecord, setRecoveryUserRecord] = useState<any | null>(null);
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState('');
  const [recoveredMsg, setRecoveredMsg] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // App Layout & Headline Customization state (Asked first during Registration)
  const [showCustomization, setShowCustomization] = useState(false);
  const [appName, setAppName] = useState('Concord Stem Cell MSC Record');
  const [companyLogo, setCompanyLogo] = useState('/src/assets/images/concord_logo_1780689503864.png');
  
  const [headlineAdmission, setHeadlineAdmission] = useState('Patient Admission Record');
  const [headlineDemographics, setHeadlineDemographics] = useState('1. Core Patient Demographics');
  const [headlineParameters, setHeadlineParameters] = useState('2. Clinical Parameters & Protocols');
  const [headlineRemarks, setHeadlineRemarks] = useState('3. Admitting Practitioner Remarks');
  const [headlineFollowUpTitle, setHeadlineFollowUpTitle] = useState('4. Follow-Up Assessment Timeline');
  
  const [labelPatientCode, setLabelPatientCode] = useState('Patient Code/ID');
  const [labelPatientName, setLabelPatientName] = useState('Patient Full Name');
  const [labelAge, setLabelAge] = useState('Patient Age');
  const [labelSex, setLabelSex] = useState('Biological Sex');
  const [labelPhone, setLabelPhone] = useState('Contact Telephone');
  const [labelDiagnosis, setLabelDiagnosis] = useState('Admitting Diagnosis');
  const [labelConsultant, setLabelConsultant] = useState('Attending Consultant');
  const [labelTreatment, setLabelTreatment] = useState('Active Treatment Protocol');
  const [labelRoute, setLabelRoute] = useState('Product Route');
  const [labelAmount, setLabelAmount] = useState('Product Dosage');
  const [labelNotes, setLabelNotes] = useState('Practitioner Notes');
  
  const [appBgColor, setAppBgColor] = useState<'default' | 'sand' | 'mint' | 'lilac' | 'blueish' | 'stark'>('default');
  const [mandatoryFields, setMandatoryFields] = useState<string[]>(['name', 'age', 'phone', 'diagnosis', 'consultant', 'treatment']);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert('Security limit: Company Logo image file must be smaller than 1.5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCompanyLogo(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/users');
      const contentType = res.headers.get('content-type');
      if (res.ok && (!contentType || !contentType.includes('application/json'))) {
        throw new Error('The secure ledger backend server is currently starting. Please reload the page in a few seconds.');
      }
      const users = res.ok ? await res.json() : {};
      const lowerUser = username.toLowerCase().trim();

      // Keep backup in secureStorage
      secureStorage.setItem('secure_ledger_users', JSON.stringify(users));

      if (!users[lowerUser]) {
        setError('Clinician profile not found. Please register first.');
        setIsLoading(false);
        return;
      }

      const userRecord = users[lowerUser];
      const salt = userRecord.salt;

      const verifierHash = await hashPassword(password, salt);
      if (verifierHash !== userRecord.verifierHash) {
        setError('Access denied. Invalid credentials provided.');
        setIsLoading(false);
        return;
      }

      // Check approval status unless they are admin or have no explicit approval value yet
      if (userRecord.role !== 'admin' && userRecord.approval !== 'approved' && userRecord.approval !== undefined) {
        if (userRecord.approval === 'rejected') {
          setError('Access Denied: Your account has been suspended or rejected by the system administrator.');
        } else {
          setError('Access Pending: Your clinician registration is currently awaiting administrator review and approval.');
        }
        setIsLoading(false);
        return;
      }

      const key = await deriveKey(password, salt);
      onLoginSuccess(userRecord.username || username, key, password);
    } catch (err: any) {
      setError('An error occurred during secure authentication: ' + (err?.message || String(err)));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username || !password || !fullName || !securityAnswer) {
      setError('Please fill in all required fields including the Security Answer.');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Security policy: Password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      const resGet = await fetch('/api/users');
      const contentType = resGet.headers.get('content-type');
      if (resGet.ok && (!contentType || !contentType.includes('application/json'))) {
        throw new Error('The secure ledger backend server is currently starting. Please reload the page in a few seconds.');
      }
      const users = resGet.ok ? await resGet.json() : {};
      const lowerUser = username.toLowerCase().trim();

      if (users[lowerUser]) {
        setError('This username is already taken by another clinician.');
        setIsLoading(false);
        return;
      }

      const salt = generateSalt();
      const verifierHash = await hashPassword(password, salt);

      // Derive key from security answer to lock the recovery payload
      const recKey = await deriveKey(securityAnswer.toLowerCase().trim(), salt);
      const recoveryPayload = await encrypt(password, recKey);

      // Determine registration role and approval status: anyone creating an id joins as admin
      const registrationRole = 'admin';
      const registrationApproval = 'approved';

      // Save user profile metadata including recovery configurations
      const userRecord = {
        username: lowerUser,
        fullName: fullName.trim(),
        specialty: specialty.trim() || 'General Clinician',
        salt,
        verifierHash,
        securityQuestion,
        recoveryPayload,
        recoveryHint: recoveryHint.trim(),
        createdAt: new Date().toISOString(),
        role: registrationRole,
        approval: registrationApproval
      };

      users[lowerUser] = userRecord;

      // Persist to server central database
      await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: lowerUser,
          userRecord
        })
      });

      secureStorage.setItem('secure_ledger_users', JSON.stringify(users));
      
      // Save user Custom App branding & custom form headlines to settings
      const initialCustomSettings = {
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
        theme: 'blue' as const,
        
        // Brand & Customisations saved instantly
        appName: appName.trim() || 'MedRecord Pro',
        companyLogo: companyLogo || '',
        headlineAdmission: headlineAdmission.trim() || 'Patient Admission Record',
        headlineDemographics: headlineDemographics.trim() || '1. Core Patient Demographics',
        headlineParameters: headlineParameters.trim() || '2. Clinical Parameters & Protocols',
        headlineRemarks: headlineRemarks.trim() || '3. Admitting Practitioner Remarks',
        headlineFollowUpTitle: headlineFollowUpTitle.trim() || '4. Follow-Up Assessment Timeline',
        labelPatientCode: labelPatientCode.trim() || 'Patient Code/ID',
        labelPatientName: labelPatientName.trim() || 'Patient Full Name',
        labelAge: labelAge.trim() || 'Patient Age',
        labelSex: labelSex.trim() || 'Biological Sex',
        labelPhone: labelPhone.trim() || 'Contact Telephone',
        labelDiagnosis: labelDiagnosis.trim() || 'Admitting Diagnosis',
        labelConsultant: labelConsultant.trim() || 'Attending Consultant',
        labelTreatment: labelTreatment.trim() || 'Active Treatment Protocol',
        labelRoute: labelRoute.trim() || 'Product Route',
        labelAmount: labelAmount.trim() || 'Product Dosage',
        labelNotes: labelNotes.trim() || 'Practitioner Notes',
        appBgColor,
        mandatoryFields
      };

      secureStorage.setItem('secure_ledger_settings', JSON.stringify(initialCustomSettings));

      if (registrationRole !== 'admin') {
        alert('Clinician profile registered successfully! Your account is currently pending administrator review and approval. Please contact the administrator to grant accessing permissions.');
        setIsRegistering(false);
        setIsLoading(false);
        return;
      }

      // Derive key to auto-login
      const key = await deriveKey(password, salt);
      onLoginSuccess(lowerUser, key, password);
    } catch (err: any) {
      setError('Cryptographic error while creating clinician profile: ' + (err?.message || String(err)));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username || !password || !fullName || !specialty || !securityAnswer) {
      setError('Please fill out all required setup fields.');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Security policy: Administrator password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      const lowerUser = username.toLowerCase().trim();
      const salt = generateSalt();
      const verifierHash = await hashPassword(password, salt);

      // Lock recovery payload
      const recKey = await deriveKey(securityAnswer.toLowerCase().trim(), salt);
      const recoveryPayload = await encrypt(password, recKey);

      const userRecord = {
        username: lowerUser,
        fullName: fullName.trim(),
        specialty: specialty.trim(),
        salt,
        verifierHash,
        securityQuestion,
        recoveryPayload,
        recoveryHint: recoveryHint.trim(),
        createdAt: new Date().toISOString(),
        role: 'admin',
        approval: 'approved'
      };

      // 1. Post original admin user record
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: lowerUser,
          userRecord
        })
      });

      // 2. Post clinic layout branding customizations
      const initialCustomSettings = {
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
        theme: 'blue' as const,
        appName: appName.trim() || 'Concord Stem Cell MSC Record',
        companyLogo: companyLogo || '',
        headlineAdmission: headlineAdmission.trim() || 'Patient Admission Record',
        headlineDemographics: headlineDemographics.trim() || '1. Core Patient Demographics',
        headlineParameters: headlineParameters.trim() || '2. Clinical Parameters & Protocols',
        headlineRemarks: headlineRemarks.trim() || '3. Admitting Practitioner Remarks',
        headlineFollowUpTitle: headlineFollowUpTitle.trim() || '4. Follow-Up Assessment Timeline',
        labelPatientCode: labelPatientCode.trim() || 'Patient Code/ID',
        labelPatientName: labelPatientName.trim() || 'Patient Full Name',
        labelAge: labelAge.trim() || 'Patient Age',
        labelSex: labelSex.trim() || 'Biological Sex',
        labelPhone: labelPhone.trim() || 'Contact Telephone',
        labelDiagnosis: labelDiagnosis.trim() || 'Admitting Diagnosis',
        labelConsultant: labelConsultant.trim() || 'Attending Consultant',
        labelTreatment: labelTreatment.trim() || 'Active Treatment Protocol',
        labelRoute: labelRoute.trim() || 'Product Route',
        labelAmount: labelAmount.trim() || 'Product Dosage',
        labelNotes: labelNotes.trim() || 'Practitioner Notes',
        appBgColor,
        mandatoryFields
      };

      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialCustomSettings)
      });

      // Secure local sync of settings
      secureStorage.setItem('secure_ledger_settings', JSON.stringify(initialCustomSettings));

      // 3. Drive security key & perform auto login as master administrator
      const key = await deriveKey(password, salt);
      setIsAdminPresent(true); // set state to dismiss wizard
      onLoginSuccess(lowerUser, key, password);
    } catch (err: any) {
      setError('Cryptographic error while creating master administrator profile: ' + (err?.message || String(err)));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    if (!recoveryUsername) {
      setRecoveryError('Please enter your Clinician ID / Email.');
      return;
    }
    try {
      const res = await fetch('/api/users');
      const contentType = res.headers.get('content-type');
      if (res.ok && (!contentType || !contentType.includes('application/json'))) {
        throw new Error('The secure ledger backend server is currently starting. Please reload the page in a few seconds.');
      }
      const users = res.ok ? await res.json() : {};
      const lowerUser = recoveryUsername.toLowerCase().trim();
      if (!users[lowerUser]) {
        setRecoveryError('Clinician profile was not found.');
        return;
      }
      const record = users[lowerUser];
      if (!record.recoveryPayload) {
        setRecoveryError('This profile does not have a setup security recovery answer.');
        return;
      }
      setRecoveryUserRecord(record);
      setRecoveryStep(2);
    } catch (err) {
      setRecoveryError('An error occurred while communicating with the server.');
    }
  };

  const handleRecoverPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveredMsg('');
    setIsLoading(true);

    if (!recoveryAnswerInput) {
      setRecoveryError('Please enter your security answer.');
      setIsLoading(false);
      return;
    }

    try {
      const salt = recoveryUserRecord.salt;
      const key = await deriveKey(recoveryAnswerInput.toLowerCase().trim(), salt);
      const dec = await decrypt(recoveryUserRecord.recoveryPayload.ciphertext, recoveryUserRecord.recoveryPayload.iv, key);
      setRecoveredMsg(dec);
      // Auto-fill password & username on success
      setUsername(recoveryUserRecord.username);
      setPassword(dec);
    } catch (err) {
      console.error(err);
      setRecoveryError('Cryptographic verification failed: Incorrect security answer.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isAdminPresent === false) {
    return (
      <div id="setup_wizard_screen" className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden text-slate-100">
        {/* Abstract design blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-500/10 blur-[130px] pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-2xl z-10 relative">
          <div className="flex justify-center flex-col items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
              <Server className="h-3 w-3 animate-pulse" /> Deployment Setup Active
            </span>
            <h1 className="text-3xl font-black tracking-tight text-center bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent uppercase font-display">
              Clinician System Bootstrap Wizard
            </h1>
            <p className="text-slate-400 text-xs text-center max-w-md font-medium leading-relaxed">
              No active administrative directory has been detected in this deployment ledger. Create your primary clinician account & define clinic configurations below.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-indigo-950/20 backdrop-blur-md">
            {/* Steps Progress Indicator */}
            <div className="flex items-center justify-between mb-8 max-w-md mx-auto relative text-slate-400">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[2px] bg-slate-800 -z-10" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500 -z-10 transition-all duration-300"
                style={{ width: wizardStep === 1 ? '50%' : '100%' }}
              />
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border font-bold text-xs transition-all ${
                  wizardStep >= 1
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 shadow-blue-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                1
              </button>
              <span className="text-xs font-semibold tracking-wider">Primary Account</span>
              <button
                type="button"
                onClick={() => {
                  if (username && password.length >= 8 && fullName && specialty) {
                    setWizardStep(2);
                  }
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-full border font-bold text-xs transition-all ${
                  wizardStep === 2
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                2
              </button>
              <span className="text-xs font-semibold tracking-wider font-sans">Clinic Customisation</span>
            </div>

            {error && (
              <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs font-semibold text-rose-300 flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={wizardStep === 2 ? handleWizardSubmit : (e) => { e.preventDefault(); setWizardStep(2); }} className="space-y-6">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-800/60 pb-3">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> 1. Administrator Clinician Credentials
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Clinician ID / Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. toticellmedicalofficer@gmail.com"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-605 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Secure Master Password <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-605 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Full Name & Medical Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dr. Eleanor Vance, MD"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-605 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Medical Specialty / Department <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Stem Cell Regenerative Specialist"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-605 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                  </div>

                  {/* Cryptographic password recovery config */}
                  <div className="bg-indigo-950/20 border border-indigo-800/35 rounded-2xl p-4 mt-2 space-y-3">
                    <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      🔑 ZK-Proof Security Question Recovery Setup
                    </h4>
                    <p className="text-[10px] text-slate-405 leading-relaxed font-semibold">
                      Configure Zero-Knowledge Password recovery using a customized security verification question. This ensures password recovery is computed in-situ locally if you lose connectivity.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          Security Question Selector
                        </label>
                        <select
                          value={securityQuestion}
                          onChange={(e) => setSecurityQuestion(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option>What was the name of your first clinical facility?</option>
                          <option>In which city is your main medical practice located?</option>
                          <option>What is the serial number of your first device?</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          Security Question Secret Answer <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Your recovery secret answer"
                          value={securityAnswer}
                          onChange={(e) => setSecurityAnswer(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                        Optional Password Reminder Hint
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. My usual numeric PIN suffix"
                        value={recoveryHint}
                        onChange={(e) => setRecoveryHint(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      disabled={!username || password.length < 8 || !fullName || !specialty || !securityAnswer}
                      onClick={() => setWizardStep(2)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                    >
                      Configure Clinic Branding <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sliders className="h-4 w-4" /> 2. Practice Customisation & Branding
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Clinic / Practice App Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Concord Stem Cell MSC Record"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-605 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Clinic Background Paint Palette
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {BG_COLOR_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAppBgColor(opt.id)}
                            className={`px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-all cursor-pointer ${
                              appBgColor === opt.id
                                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                                : 'bg-slate-950 border-slate-800/80 text-slate-405 hover:text-slate-200'
                            }`}
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Practice Logo Image upload (Local File Selection)
                    </label>
                    <div className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60">
                      {companyLogo && (
                        <img
                          src={companyLogo}
                          alt="Company Logo Preview"
                          className="h-12 w-12 object-contain bg-white rounded-lg p-1 border border-slate-700/50"
                        />
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          id="wizard_company_logo_input"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="wizard_company_logo_input"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-705 text-slate-300 border border-slate-700/40 cursor-pointer uppercase tracking-wider transition-colors"
                        >
                          <Image className="h-3.5 w-3.5" /> Choose Logo File
                        </label>
                        <p className="text-[9px] text-slate-500 mt-1 font-medium">Supports PNG, JPEG, SVG under 1.5MB.</p>
                      </div>
                    </div>
                  </div>

                  {/* Section Label Layout customization */}
                  <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/40 space-y-3.5">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      📄 Layout Field Headings & Label customization
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[8px] font-extrabold text-slate-550 uppercase tracking-widest mb-1">
                          Form Headline
                        </label>
                        <input
                          type="text"
                          value={headlineAdmission}
                          onChange={(e) => setHeadlineAdmission(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-extrabold text-slate-550 uppercase tracking-widest mb-1">
                          Demographics Title
                        </label>
                        <input
                          type="text"
                          value={headlineDemographics}
                          onChange={(e) => setHeadlineDemographics(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-extrabold text-slate-550 uppercase tracking-widest mb-1">
                          Patient Code Label
                        </label>
                        <input
                          type="text"
                          value={labelPatientCode}
                          onChange={(e) => setLabelPatientCode(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-extrabold text-slate-550 uppercase tracking-widest mb-1">
                          Patient Name Label
                        </label>
                        <input
                          type="text"
                          value={labelPatientName}
                          onChange={(e) => setLabelPatientName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[10px]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-slate-400 hover:text-slate-200 text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" /> Credentials
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Initializing Environment Ledger ...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 animate-bounce" /> Complete Live Deployment Setup
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="login_screen" className="min-h-screen bg-radial from-slate-50 via-zinc-50 to-indigo-50/30 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Abstract medical gradient background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-cyan-400/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-400/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[35%] h-[35%] rounded-full bg-violet-400/10 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl z-10 relative">
        <div className="flex justify-center flex-col items-center select-none pb-4">
          <div className="relative flex items-center justify-center p-8">
            {/* Waving concentric outer rings radiating outwards */}
            <div className="absolute w-24 h-24 rounded-full border border-indigo-500/30 animate-pulse" />
            <div className="absolute w-28 h-28 rounded-full border border-purple-500/20 animate-ping [animation-duration:3s]" />
            <div className="absolute w-32 h-32 rounded-full border border-pink-500/10 animate-ping [animation-duration:4.5s] [animation-delay:1.5s]" />
            
            {/* Soft background pulse container */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 blur-xl animate-pulse" />

            {/* Premium structural modular font core */}
            <div className="relative z-10 flex items-center justify-center bg-white/95 border border-slate-200/80 shadow-xl rounded-3xl p-4 w-20 h-20 transition-all duration-300 hover:scale-110 hover:shadow-indigo-300/40 backdrop-blur-sm group overflow-hidden">
              {/* Star-burst glitter elements using responsive CSS animations */}
              <div className="absolute top-1 right-2 text-yellow-400 text-xs animate-bounce [animation-duration:3.2s] pointer-events-none">✨</div>
              <div className="absolute bottom-2 left-1.5 text-amber-300 text-xs animate-pulse [animation-duration:1.8s] pointer-events-none">⭐</div>
              <div className="absolute top-3.5 left-1.5 text-purple-400 text-[8px] animate-ping [animation-duration:2.8s] pointer-events-none">✨</div>
              <div className="absolute bottom-1 right-2 text-cyan-400 text-xs animate-bounce [animation-duration:2.4s] pointer-events-none">✨</div>

              {/* Monogram Display letter with shining text clipping */}
              <span className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent transform group-hover:rotate-6 transition-all duration-300 pointer-events-none tracking-normal font-sans">
                C
              </span>
            </div>
          </div>
        </div>
        <h2 className="mt-2 text-center text-3xl font-black text-slate-850 tracking-tight uppercase font-display bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 bg-clip-text text-transparent">
          {appName || 'MedRecord Pro'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl z-10 relative">
        <div className="bg-white/80 py-8 px-6 shadow-2xl shadow-slate-200/60 border border-slate-100 rounded-3xl sm:px-10 backdrop-blur-md">
          <div className="flex border-b border-slate-100 mb-6 p-1 bg-slate-50/50 rounded-2xl">
            <button
              id="set_login_mode_btn"
              type="button"
              className={`flex-1 py-3 text-center font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                !isRegistering
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/10'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/40'
              }`}
              onClick={() => {
                setIsRegistering(false);
                setError('');
              }}
            >
              Log in
            </button>
            <button
              id="set_register_mode_btn"
              type="button"
              className={`flex-1 py-3 text-center font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                isRegistering
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/10'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/40'
              }`}
              onClick={() => {
                setIsRegistering(true);
                setError('');
              }}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div id="auth_error_alert" className="mb-4 bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fullName" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Full Name & Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      placeholder="Dr. Eleanor Vance, MD"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label htmlFor="specialty" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Department / Specialty
                    </label>
                    <input
                      id="specialty"
                      name="specialty"
                      type="text"
                      placeholder="Neurology, Cardiology etc."
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label htmlFor="regRole" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Role Privilege <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="regRole"
                      value="admin"
                      disabled
                      className="mt-1 block w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium disabled:opacity-75"
                      required
                    >
                      <option value="admin">Admin Partner</option>
                    </select>
                    <p className="text-[10px] text-emerald-600 mt-1.5 font-semibold flex items-center gap-1 font-sans">
                      <span>✓ All new clinician registrations automatically join with Administrator privileges.</span>
                    </p>
                  </div>
                </div>

                {/* Cryptographic Zero-Knowledge Password Recovery Registration */}
                <div className="bg-blue-50/25 border border-blue-100 p-4 rounded-2xl space-y-3">
                  <h4 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    🔑 Clinician Password Recovery Configuration
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-medium font-sans">
                    Enable password recovery locally on this device. We encrypt your master password with a key derived from your custom security answer.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Select Security Recovery Question <span className="text-rose-500">*</span></label>
                      <select
                        value={securityQuestion}
                        onChange={(e) => setSecurityQuestion(e.target.value)}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium"
                        required
                      >
                        <option value="What was the name of your first clinical facility?">What was the name of your first clinical facility?</option>
                        <option value="What is your mother's maiden name?">What is your mother's maiden name?</option>
                        <option value="What was the brand of your first stethoscope?">What was the brand of your first stethoscope?</option>
                        <option value="What was the name of your first clinical supervisor?">What was the name of your first clinical supervisor?</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Security Recovery Answer (Case-Insensitive) <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        placeholder="e.g. Mount Sinai"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium"
                        required={isRegistering}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Password Hint (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Starts with capital letter"
                        value={recoveryHint}
                        onChange={(e) => setRecoveryHint(e.target.value)}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* EXPANDABLE branding and form headlines customization panel */}
                <div className="mt-2 border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => setShowCustomization(!showCustomization)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🏥 App Customisation & Form Branding
                        </p>
                        <p className="text-[9px] text-slate-400 uppercase font-semibold">
                          Customize App Titles, Logo and form Labels first!
                        </p>
                      </div>
                    </div>
                    {showCustomization ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>

                  {showCustomization && (
                    <div className="p-4 border-t border-slate-150 bg-white space-y-4 max-h-[300px] overflow-y-auto">
                      
                      {/* Brand name & Logo */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-[9px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Image className="h-3.5 w-3.5" /> 1. Primary Practice Identity
                        </h4>
                        
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase">App / Clinic Name</label>
                          <input
                            type="text"
                            value={appName}
                            onChange={(e) => setAppName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Upload Practice Logo</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="mt-1 block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                          />
                          {companyLogo && (
                            <div className="mt-2 flex items-center gap-2">
                              <img src={companyLogo} alt="Logo preview" className="h-8 max-w-[120px] object-contain border border-slate-200 p-0.5 rounded" referrerPolicy="no-referrer" />
                              <button type="button" onClick={() => setCompanyLogo('')} className="text-[9px] text-red-500 underline uppercase font-bold">Remove</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Headline Customizations */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-[9px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" /> 2. Form Section Headlines
                        </h4>

                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Admission Form Main Title</label>
                          <input
                            type="text"
                            value={headlineAdmission}
                            onChange={(e) => setHeadlineAdmission(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Section 1: Demographics Headline</label>
                          <input
                            type="text"
                            value={headlineDemographics}
                            onChange={(e) => setHeadlineDemographics(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Section 2: Clinical Parameters Headline</label>
                          <input
                            type="text"
                            value={headlineParameters}
                            onChange={(e) => setHeadlineParameters(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Section 3: Remarks Headline</label>
                          <input
                            type="text"
                            value={headlineRemarks}
                            onChange={(e) => setHeadlineRemarks(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Section 4: Follow-Ups Timeline Headline</label>
                          <input
                            type="text"
                            value={headlineFollowUpTitle}
                            onChange={(e) => setHeadlineFollowUpTitle(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs"
                          />
                        </div>
                      </div>

                      {/* Field Label Customization */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                          🏷️ 3. Form Input Field Labels
                        </h4>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Patient Code Label</label>
                            <input
                              type="text"
                              value={labelPatientCode}
                              onChange={(e) => setLabelPatientCode(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Patient Name Label</label>
                            <input
                              type="text"
                              value={labelPatientName}
                              onChange={(e) => setLabelPatientName(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Age Label</label>
                            <input
                              type="text"
                              value={labelAge}
                              onChange={(e) => setLabelAge(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Sex / Gender Label</label>
                            <input
                              type="text"
                              value={labelSex}
                              onChange={(e) => setLabelSex(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Telephone Label</label>
                            <input
                              type="text"
                              value={labelPhone}
                              onChange={(e) => setLabelPhone(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Diagnosis Label</label>
                            <input
                              type="text"
                              value={labelDiagnosis}
                              onChange={(e) => setLabelDiagnosis(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Consultant Label</label>
                            <input
                              type="text"
                              value={labelConsultant}
                              onChange={(e) => setLabelConsultant(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Treatment Protocol</label>
                            <input
                              type="text"
                              value={labelTreatment}
                              onChange={(e) => setLabelTreatment(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Product Route Label</label>
                            <input
                              type="text"
                              value={labelRoute}
                              onChange={(e) => setLabelRoute(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Product Dosage Label</label>
                            <input
                              type="text"
                              value={labelAmount}
                              onChange={(e) => setLabelAmount(e.target.value)}
                              className="block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase">Practitioner Remarks Label</label>
                          <input
                            type="text"
                            value={labelNotes}
                            onChange={(e) => setLabelNotes(e.target.value)}
                            className="mt-1 block w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800"
                          />
                        </div>
                      </div>

                      {/* Display Background Theme Preset */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-[9px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                          🌈 4. display background preset
                        </h4>
                        <p className="text-[9px] text-slate-400">Choose custom atmospheric tone for the EHR backdrops:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {BG_COLOR_OPTIONS.map((bg) => (
                            <button
                              key={bg.id}
                              type="button"
                              onClick={() => setAppBgColor(bg.id)}
                              className={`p-2 rounded-xl border flex items-center gap-2 text-[10px] font-bold text-slate-700 transition-all text-left cursor-pointer ${
                                appBgColor === bg.id 
                                  ? 'bg-blue-50/70 border-blue-500 ring-1 ring-blue-500' 
                                  : 'bg-white border-slate-200 hover:border-slate-350'
                              }`}
                            >
                              <div className={`h-3.5 w-3.5 rounded-full shrink-0 ${bg.colorDot} shadow-xs`} />
                              <span className="truncate">{bg.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Required / Mandatory criteria */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-[9px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                          🔑 5. required field criteria (mandatory)
                        </h4>
                        <p className="text-[9px] text-slate-400">Mark which clinical details clinicians *must* provide upon admission:</p>
                        
                        <div className="grid grid-cols-2 gap-2">
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
                            const isChecked = mandatoryFields.includes(field.id);
                            return (
                              <label
                                key={field.id}
                                className={`p-2 rounded-xl border flex items-center gap-2.5 text-[10px] uppercase font-bold text-slate-700 cursor-pointer select-none transition-all ${
                                  isChecked 
                                    ? 'bg-emerald-50/20 border-emerald-400 text-emerald-850' 
                                    : 'bg-white border-slate-250 hover:border-slate-350'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setMandatoryFields(mandatoryFields.filter(f => f !== field.id));
                                    } else {
                                      setMandatoryFields([...mandatoryFields, field.id]);
                                    }
                                  }}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                                />
                                <span className="truncate">{field.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </>
            )}

            {isRecovering ? (
              <div id="recovery_panel" className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-extrabold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                    🔑 Offline Password Recovery
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecovering(false);
                      setRecoveryStep(1);
                      setRecoveryUsername('');
                      setRecoveryUserRecord(null);
                      setRecoveryAnswerInput('');
                      setRecoveredMsg('');
                      setRecoveryError('');
                    }}
                    className="text-[9px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Back to Log in
                  </button>
                </div>

                {recoveryError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 font-medium">
                    {recoveryError}
                  </div>
                )}

                {recoveredMsg ? (
                  <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 text-xs text-emerald-850 space-y-2.5 font-medium">
                    <p className="font-extrabold text-emerald-900 uppercase tracking-wider text-[10px]">
                      🔒 Profile Decrypted Successfully!
                    </p>
                    <p>Your recovered master password is:</p>
                    <p className="font-mono text-xs bg-white border border-emerald-200 p-2.5 text-emerald-950 font-bold tracking-widest text-center select-all whitespace-pre-wrap break-all rounded-xl shadow-xs">
                      {recoveredMsg}
                    </p>
                    <p className="text-[9px] text-slate-400 leading-normal">
                      The password has been auto-filled in the form. Click "Back to Log in" above and unlock your database now.
                    </p>
                  </div>
                ) : recoveryStep === 1 ? (
                  <div className="space-y-3.5">
                    <div>
                      <label htmlFor="recover_id" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Clinician ID / Email
                      </label>
                      <input
                        id="recover_id"
                        type="text"
                        placeholder="clinician_id"
                        value={recoveryUsername}
                        onChange={(e) => setRecoveryUsername(e.target.value)}
                        className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRecoverUsernameSubmit}
                      className="w-full flex justify-center py-2.5 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                    >
                      Retrieve Security Challenge
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="bg-blue-50/25 border border-blue-100 p-3.5 rounded-xl text-xs space-y-1 text-slate-700">
                      <p className="font-extrabold text-blue-700 uppercase tracking-widest text-[9px]">
                        Security Question:
                      </p>
                      <p className="font-semibold text-slate-850">
                        {recoveryUserRecord?.securityQuestion}
                      </p>
                      {recoveryUserRecord?.recoveryHint && (
                        <p className="text-[10px] text-slate-400 font-sans mt-2">
                          Hint: {recoveryUserRecord.recoveryHint}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="recover_ans" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Your Security Answer
                      </label>
                      <input
                        id="recover_ans"
                        type="text"
                        placeholder="Type answer here..."
                        value={recoveryAnswerInput}
                        onChange={(e) => setRecoveryAnswerInput(e.target.value)}
                        className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRecoverPasswordSubmit}
                      disabled={isLoading}
                      className="w-full flex justify-center py-2.5 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? "Deriving Key & Verifying..." : "Verify & Decrypt"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="username" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Clinician ID / Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="clinician_id"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="password" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecovering(true);
                        setRecoveryError('');
                        setRecoveredMsg('');
                      }}
                      className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Forgot / Recover Password?
                    </button>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder={isRegistering ? "Min 8 characters" : "••••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  />
                  <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed font-medium">
                    {isRegistering 
                      ? "This password derives a dynamic symmetric key. It is never stored or transmitted." 
                      : "Derives the key to instantly process patient records."}
                  </p>
                </div>
              </>
            )}

            {!isRecovering && (
              <div className="pt-2">
                <button
                  id="auth_submit_btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deriving Cryptographics...
                    </span>
                  ) : isRegistering ? (
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="h-4 w-4" /> Sign Up
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <LogIn className="h-4 w-4 animate-pulse" /> Log in
                    </span>
                  )}
                </button>
              </div>
            )}
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <button
              id="crypto_details_toggle"
              type="button"
              onClick={() => setShowDetails(!showDetais)}
              className="text-[10px] font-bold tracking-wider uppercase text-slate-400 hover:text-blue-600 inline-flex items-center gap-1 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Cryptographic Parameters
            </button>
            {showDetais && (
              <div id="crypto_details_panel" className="mt-3 text-left bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-[11px] text-slate-500 space-y-2 leading-relaxed font-medium">
                <p>
                  <strong>🔐 Zero-Knowledge Standard</strong>: Patient records are never sent plaintext. All decryption and encryption happens locally inside this sandboxed browser frame.
                </p>
                <p>
                  <strong>🧬 PBKDF2 Hashing Scheme</strong>: Generates an immutable symmetric 256-bit key through 100,000 iterations of SHA-256 with a secure cryptographically seeded salt.
                </p>
                <p>
                  <strong>🛡️ AES-GCM Cipher</strong>: Operates with unique, distinct initialization vectors per patient payload, neutralizing potential frequency or matching attacks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

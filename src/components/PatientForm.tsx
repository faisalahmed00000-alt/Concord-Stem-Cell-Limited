import React, { useState, useRef, useEffect } from 'react';
import { User, ClipboardList, Shield, Plus, RefreshCw, Calendar, Phone, Hash, Paperclip, Trash2, Upload, MapPin } from 'lucide-react';
import { Patient, PatientAttachment } from '../types/patient';
import { FormSettings, ThemeOption } from '../types/settings';

interface MultiSelectDropdownProps {
  id?: string;
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isDark: boolean;
  required?: boolean;
  activeTheme?: any;
}

export function MultiSelectDropdown({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  isDark,
  required = false,
  activeTheme
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedItems = value 
    ? value.split(', ').map(x => x.trim()).filter(Boolean)
    : [];

  const handleToggleOption = (option: string) => {
    let next: string[];
    if (selectedItems.includes(option)) {
      next = selectedItems.filter(item => item !== option);
    } else {
      next = [...selectedItems, option];
    }
    onChange(next.join(', '));
  };

  const handleAddCustom = (customText: string) => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    if (!selectedItems.includes(trimmed)) {
      onChange([...selectedItems, trimmed].join(', '));
    }
  };

  const [customInput, setCustomInput] = useState('');

  return (
    <div ref={containerRef} className="relative w-full" id={id}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer transition-all ${
          isDark 
            ? 'bg-slate-955 border-slate-805/60 text-slate-105' 
            : 'bg-white border-slate-201 text-slate-950'
        }`}
      >
        <span className="truncate">
          {selectedItems.length > 0 
            ? selectedItems.join(', ') 
            : placeholder}
        </span>
        <span className="pointer-events-none ml-2">
          <svg className="h-4 w-4 text-slate-450" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl border p-2 shadow-xl ${
          isDark 
            ? 'bg-slate-955 border-slate-805 text-slate-105 shadow-black/80' 
            : 'bg-white border-slate-201 text-slate-800 shadow-slate-200/80'
        }`}>
          <div className="space-y-1">
            {options.map((option) => {
              const isSelected = selectedItems.includes(option);
              return (
                <label
                  key={option}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    isDark ? 'hover:bg-slate-900/60 text-slate-200' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleOption(option)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                  />
                  <span className="truncate">{option}</span>
                </label>
              );
            })}
          </div>

          <div className={`mt-2 pt-2 border-t flex gap-1.5 ${isDark ? 'border-slate-850' : 'border-slate-100'}`}>
            <input
              type="text"
              placeholder="Add other custom..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustom(customInput);
                  setCustomInput('');
                }
              }}
              className={`block w-full px-2.5 py-1.5 border rounded-lg text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                handleAddCustom(customInput);
                setCustomInput('');
              }}
              className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-colors ${
                activeTheme ? activeTheme.primaryBg : 'bg-indigo-600'
              } text-white`}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PatientFormProps {
  onAddPatient: (patientData: Omit<Patient, 'id' | 'followUps' | 'createdAt'>) => void;
  onCancel?: () => void;
  settings: FormSettings;
  activeTheme: ThemeOption;
  onUpdateSettings?: (settings: FormSettings) => void;
}

const IMPROVEMENT_STATUSES = [
  'Significantly Improved',
  'Improved',
  'Stable',
  'Unchanged',
  'Deteriorated',
] as const;

export default function PatientForm({ onAddPatient, onCancel, settings, activeTheme, onUpdateSettings }: PatientFormProps) {
  const [code, setCode] = useState(() => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PAT-2026-${rand}`;
  });
  
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [sex, setSex] = useState<'Male' | 'Female' | 'Other'>('Female');
  const [phone, setPhone] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [customDiagnosis, setCustomDiagnosis] = useState('');
  const [consultant, setConsultant] = useState('');
  const [customConsultant, setCustomConsultant] = useState('');
  const [treatment, setTreatment] = useState('');
  const [customTreatment, setCustomTreatment] = useState('');
  const [route, setRoute] = useState(settings.routes[0] || 'Intravenous (IV) Infusion');
  const [customRoute, setCustomRoute] = useState('');
  const [procedurePlace, setProcedurePlace] = useState((settings.procedurePlaces && settings.procedurePlaces[0]) || 'Operating Room A');
  const [customProcedurePlace, setCustomProcedurePlace] = useState('');
  const [amount, setAmount] = useState('');
  const [sessionNo, setSessionNo] = useState<number>(1);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [improvement, setImprovement] = useState<'Significantly Improved' | 'Improved' | 'Stable' | 'Deteriorated' | 'Unchanged'>('Stable');
  const [notes, setNotes] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [requiresFollowUp, setRequiresFollowUp] = useState(true);
  const [attachments, setAttachments] = useState<PatientAttachment[]>([]);

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      setAttachments((prev) => [...prev, newAttachment]);
    };
    reader.onerror = () => {
      alert('Error parsing uploaded file attachment.');
    };
    reader.readAsDataURL(file);
  };

  const isRequired = (fieldId: string) => {
    const list = settings.mandatoryFields || ['name', 'age', 'phone', 'diagnosis', 'consultant', 'treatment'];
    return list.includes(fieldId);
  };

  const generateNewCode = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setCode(`PAT-2026-${rand}`);
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert('Patient profile picture cannot exceed 1.5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfilePic(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      alert('Patient code/ID is required.');
      return;
    }

    if (isRequired('name') && !name.trim()) {
      alert(`Please enter a valid value for ${settings.labelPatientName || 'Patient Full Name'}.`);
      return;
    }

    if (isRequired('age') && age === '') {
      alert(`Please enter a valid value for ${settings.labelAge || 'Patient Age'}.`);
      return;
    }

    if (isRequired('phone') && !phone.trim()) {
      alert(`Please enter a valid value for ${settings.labelPhone || 'Contact Telephone'}.`);
      return;
    }

    if (isRequired('consultant') && !consultant.trim()) {
      alert(`Please select or specify a valid ${settings.labelConsultant || 'Attending Consultant'}.`);
      return;
    }

    if (isRequired('diagnosis') && !diagnosis.trim()) {
      alert(`Please select or specify a valid ${settings.labelDiagnosis || 'Admitting Diagnosis'}.`);
      return;
    }

    if (isRequired('route') && !route.trim()) {
      alert(`Please select or specify a valid ${settings.labelRoute || 'Product Route'}.`);
      return;
    }

    const finalProcedurePlace = procedurePlace === 'Other' ? customProcedurePlace.trim() : procedurePlace;
    if (isRequired('procedurePlace') && !finalProcedurePlace) {
      alert(`Please select or specify a valid ${settings.labelProcedurePlace || 'Procedure Place'}.`);
      return;
    }

    const finalTreatment = treatment === 'Other' || !treatment ? customTreatment.trim() : treatment;
    if (isRequired('treatment') && !finalTreatment) {
      alert(`Please select or specify a valid ${settings.labelTreatment || 'Active Treatment Protocol'}.`);
      return;
    }

    if (isRequired('amount') && !amount.trim()) {
      alert(`Please enter a valid value for ${settings.labelAmount || 'Product Dosage'}.`);
      return;
    }

    if (isRequired('notes') && !notes.trim()) {
      alert(`Please enter a valid value for ${settings.labelNotes || 'Clinical Remarks'}.`);
      return;
    }

    onAddPatient({
      code: code.trim(),
      name: name.trim(),
      age: age === '' ? 0 : Number(age),
      sex,
      phone: phone.trim(),
      diagnosis: diagnosis.trim(),
      consultant: consultant.trim(),
      treatment: finalTreatment,
      route: route.trim(),
      procedurePlace: finalProcedurePlace,
      amount: amount.trim(),
      sessionNo: Number(sessionNo),
      date,
      improvement,
      notes: notes.trim(),
      requiresFollowUp,
      profilePic: profilePic || undefined,
      attachments: attachments
    });
  };

  const isDark = activeTheme.isDark;

  // Custom Labels Fallbacks
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
  const labelNotes = settings.labelNotes || 'Clinical Notes & Observations';

  // Custom Headlines Fallbacks
  const headlineAdmission = settings.headlineAdmission || 'Patient Admission Record';
  const headlineDemographics = settings.headlineDemographics || '1. Core Patient Demographics';
  const headlineParameters = settings.headlineParameters || '2. Clinical Parameters & Protocols';

  return (
    <div id="patient_form_container" className={`rounded-3xl border shadow-sm overflow-hidden transition-colors ${
      isDark ? 'bg-slate-900 border-slate-800 text-slate-150' : 'bg-white border-slate-100 text-slate-900'
    }`}>
      {/* Form Title Headline */}
      <div className={`px-6 py-4 border-b flex items-center justify-between ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${activeTheme.primaryBg}`}>P</div>
          <h2 className={`text-sm font-bold tracking-tight uppercase ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            {headlineAdmission}
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Section 1: Demographics Title Headline */}
        <div className="space-y-4">
          <h3 className={`text-[12px] font-bold uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          } ${activeTheme.primaryText}`}>
            <User className="h-3.5 w-3.5" /> {headlineDemographics}
          </h3>

          {/* Patient Photo Attachment Widget */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 ${
            isDark ? 'bg-slate-955/40 border-slate-800/80' : 'bg-slate-50/50 border-slate-200/60'
          }`}>
            <div className={`w-16 h-16 rounded-full border overflow-hidden flex items-center justify-center shrink-0 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              {profilePic ? (
                <img src={profilePic} alt="Patient Portrait" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="h-7 w-7 text-slate-400" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h4 className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Patient Profile Picture</h4>
              <p className="text-[10px] text-slate-400">Attach clinical identification photograph. Max 1.5 MB.</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePicChange}
                  className="block text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-105 cursor-pointer"
                />
                {profilePic && (
                  <button 
                    type="button" 
                    onClick={() => setProfilePic('')} 
                    className="text-[10px] text-rose-500 font-bold uppercase hover:underline"
                  >
                    Clear photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="patient_code" className={`block text-[11px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelPatientCode} <span className="text-rose-500">*</span>
              </label>
              <div className="flex rounded-xl shadow-none">
                <input
                  id="patient_code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`block w-full px-3.5 py-2.5 border rounded-l-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  id="generate_code_btn"
                  type="button"
                  onClick={generateNewCode}
                  title="Generate safe clinical registry code"
                  className={`inline-flex items-center px-3 border border-l-0 rounded-r-xl transition-colors cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-805 text-slate-300 hover:text-blue-400' : 'bg-slate-101 border-slate-200 text-slate-500 hover:text-blue-600'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="patient_name" className={`block text-[11px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelPatientName} {isRequired('name') && <span className="text-rose-500">*</span>}
              </label>
              <input
                id="patient_name"
                type="text"
                required={isRequired('name')}
                placeholder="Elizabeth Bennet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-955 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label htmlFor="patient_phone" className={`block text-[11px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelPhone} {isRequired('phone') && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                <input
                  id="patient_phone"
                  type="tel"
                  required={isRequired('phone')}
                  placeholder="+1 (555) 012-3840"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`block w-full pl-9 pr-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-955 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="patient_age" className={`block text-[11px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelAge} {isRequired('age') && <span className="text-rose-500">*</span>}
              </label>
              <input
                id="patient_age"
                type="number"
                required={isRequired('age')}
                min="0"
                max="130"
                placeholder="38"
                value={age}
                onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-955 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label htmlFor="patient_sex" className={`block text-[11px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelSex} {isRequired('sex') && <span className="text-rose-500">*</span>}
              </label>
              <select
                id="patient_sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as 'Male' | 'Female' | 'Other')}
                required={isRequired('sex')}
                className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-955 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900 bg-white'
                }`}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="patient_date" className={`block text-[11px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                Treatment Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <input
                  id="patient_date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`block w-full pl-9 pr-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-955 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Clinical Details headline */}
        <div className="space-y-4 pt-2">
          <h3 className={`text-[12px] font-bold uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          } ${activeTheme.primaryText}`}>
            <ClipboardList className="h-3.5 w-3.5" /> {headlineParameters}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-[11px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelDiagnosis} {isRequired('diagnosis') && <span className="text-rose-500">*</span>}
              </label>
              <MultiSelectDropdown
                id="patient_diagnosis"
                label={labelDiagnosis}
                options={settings.diagnoses}
                value={diagnosis}
                onChange={setDiagnosis}
                placeholder="-- Select Standard Clinical Diagnoses --"
                isDark={isDark}
                required={isRequired('diagnosis')}
                activeTheme={activeTheme}
              />
            </div>

            <div>
              <label className={`block text-[12px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelConsultant} {isRequired('consultant') && <span className="text-rose-500">*</span>}
              </label>
              <MultiSelectDropdown
                id="patient_consultant"
                label={labelConsultant}
                options={settings.consultants}
                value={consultant}
                onChange={setConsultant}
                placeholder="-- Select Registered Consultants --"
                isDark={isDark}
                required={isRequired('consultant')}
                activeTheme={activeTheme}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="patient_treatment" className={`block text-[12px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelTreatment} {isRequired('treatment') && <span className="text-rose-500">*</span>}
              </label>
              <select
                id="patient_treatment"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                required={isRequired('treatment')}
                className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                  isDark ? 'bg-slate-955 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-210 text-slate-900 bg-white'
                }`}
              >
                <option value="">-- Select Standard Treatment Protocol --</option>
                {(settings.treatments || [
                  'Excedrin IV Dosing Protocol',
                  'Neuromuscular Blockade Protocol',
                  'Exosome Infusion Therapy',
                  'Standard Stem Cell Intravenous Protocol',
                  'Targeted Spine Joint Prolotherapy',
                  'Regenerative Joint Infiltration',
                  'Myofascial Trigger Point Injection'
                ]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="Other">Other (Specify Below)...</option>
              </select>

              {(treatment === 'Other' || treatment === '') && (
                <input
                  id="patient_custom_treatment"
                  type="text"
                  required={isRequired('treatment')}
                  placeholder="Enter custom clinical treatment details"
                  value={customTreatment}
                  onChange={(e) => setCustomTreatment(e.target.value)}
                  className={`mt-2 block w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              )}
            </div>

            <div>
              <label htmlFor="patient_amount" className={`block text-[12px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelAmount} {isRequired('amount') && <span className="text-rose-500">*</span>}
              </label>
              <input
                id="patient_amount"
                type="text"
                required={isRequired('amount')}
                placeholder="50 mg / 100 mL"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-405 ${
                  isDark ? 'bg-slate-955 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="order-2 md:order-2">
              <label className={`block text-[12px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelRoute} {isRequired('route') && <span className="text-rose-500">*</span>}
              </label>
              <MultiSelectDropdown
                id="patient_route"
                label={labelRoute}
                options={settings.routes}
                value={route}
                onChange={setRoute}
                placeholder="-- Select Administration Routes --"
                isDark={isDark}
                required={isRequired('route')}
                activeTheme={activeTheme}
              />
            </div>

            <div className="order-1 md:order-1">
              <label htmlFor="patient_procedure_place" className={`block text-[12px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
                {labelProcedurePlace} {isRequired('procedurePlace') && <span className="text-rose-500">*</span>}
              </label>
              <select
                id="patient_procedure_place"
                value={procedurePlace}
                onChange={(e) => setProcedurePlace(e.target.value)}
                required={isRequired('procedurePlace')}
                className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                  isDark ? 'bg-slate-955 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-201 text-slate-900 bg-white'
                }`}
              >
                {/* Fallback to default procedure places if not specified in settings */}
                {(settings.procedurePlaces || [
                  'Operating Room A',
                  'Minor Procedure Suite',
                  'Outpatient Treatment Bay 3',
                  'Infusion Lounge'
                ]).map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
                <option value="Other">Other (Specify below)...</option>
              </select>

              {procedurePlace === 'Other' && (
                <input
                  id="patient_custom_procedure_place"
                  type="text"
                  required={isRequired('procedurePlace')}
                  placeholder="e.g., Ward 4B, Room 302"
                  value={customProcedurePlace}
                  onChange={(e) => setCustomProcedurePlace(e.target.value)}
                  className={`mt-2 block w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-105' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Notes Title Headline */}
        <div className="space-y-2">
          <label htmlFor="patient_notes" className={`block text-[12px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
            {labelNotes} {isRequired('notes') && <span className="text-rose-500">*</span>}
          </label>
          <textarea
            id="patient_notes"
            rows={3}
            required={isRequired('notes')}
            placeholder="Add patient diagnosis remarks, pain reports, response indicators, session outcomes, side effects..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`block w-full px-3.5 py-2.5 border rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 leading-relaxed resize-none h-24 ${
              isDark ? 'bg-slate-955 border-slate-800 text-slate-150' : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          ></textarea>
        </div>

        {/* Section 4: Clinical File Attachments */}
        <div className="space-y-3.5 pt-2">
          <div>
            <span className={`block text-[12px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-405'}`}>
              Diagnostic Lab & Clinical Attachments
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Upload laboratory results, MRIs, scans, or consent forms associated with this patient admission record. Max file size: 15MB.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label
                htmlFor="clinical_attachment_upload"
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-300 hover:text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs'
                }`}
              >
                <Upload className="h-3.5 w-3.5 text-blue-500" />
                Select File to Attach
                <input
                  id="clinical_attachment_upload"
                  type="file"
                  onChange={handleAttachmentUpload}
                  className="hidden"
                />
              </label>

              {attachments.length > 0 && (
                <span className="text-[10px] text-slate-400 italic">
                  {attachments.length} file{attachments.length > 1 ? 's' : ''} attached
                </span>
              )}
            </div>

            {attachments.length === 0 ? (
              <div
                className={`text-[10px] italic rounded-2xl p-4 border border-dashed text-center ${
                  isDark ? 'bg-slate-955/20 border-slate-800/80 text-slate-500' : 'bg-slate-50/50 border-slate-200/60 text-slate-400'
                }`}
              >
                No files attached. Attach diagnostic records or imaging scans if available.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {attachments.map((file) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                    <div
                      key={file.id}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${
                        isDark ? 'bg-slate-950/60 hover:bg-slate-900 border-slate-800/80' : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isImage ? (
                          <div
                            className={`w-8 h-8 rounded border overflow-hidden flex items-center justify-center shrink-0 ${
                              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                            }`}
                          >
                            <img src={file.data} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div
                            className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-extrabold text-[9px] uppercase border ${
                              isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {file.name.split('.').pop()?.substring(0, 3) || 'doc'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== file.id))}
                        className={`p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer`}
                        title="Remove attachment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Requires Post-Treatment Follow-Up Scheduler Track */}
        <div className="flex items-center gap-3 p-4 rounded-2xl border bg-slate-500/5 border-slate-200/50 dark:border-slate-800/80 select-none">
          <input
            id="patient_requires_followup"
            type="checkbox"
            checked={requiresFollowUp}
            onChange={(e) => setRequiresFollowUp(e.target.checked)}
            className={`h-4.5 w-4.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer ${
              isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-300 bg-white'
            }`}
          />
          <div className="min-w-0">
            <label htmlFor="patient_requires_followup" className={`block text-[11px] font-extrabold uppercase tracking-widest cursor-pointer ${isDark ? 'text-slate-205 hover:text-white' : 'text-slate-705 hover:text-slate-900'}`}>
              Requires Post-Treatment Follow-Up Scheduler Track
            </label>
            <p className="text-[10px] text-slate-400 mt-0.5">
              If selected, this patient will register in the 6-Month EHR follow-up schedules.
            </p>
          </div>
        </div>

        {/* Actions cancel and submit */}
        <div className={`pt-4 border-t flex items-center justify-end gap-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          {onCancel && (
            <button
              id="cancel_patient_btn"
              type="button"
              onClick={onCancel}
              className={`px-4 py-2 border rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                isDark 
                  ? 'bg-slate-850 border-slate-751 hover:bg-slate-800 text-slate-400 hover:text-slate-200' 
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              Cancel
            </button>
          )}
          <button
            id="submit_patient_btn"
            type="submit"
            className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer ${activeTheme.primaryBg}`}
          >
            <Plus className="h-4 w-4" /> Log Patient Entry
          </button>
        </div>
      </form>
    </div>
  );
}

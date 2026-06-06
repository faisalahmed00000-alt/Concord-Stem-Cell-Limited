export type ThemeColor = 'blue' | 'teal' | 'indigo' | 'rose' | 'emerald' | 'slate' | 'dark';

export interface FormSettings {
  diagnoses: string[];
  routes: string[];
  procedurePlaces?: string[];
  consultants: string[];
  treatments?: string[];
  theme: ThemeColor;
  disableAdminJoining?: boolean;  // Lock registration privileges so new clinicians can only join as standard users requiring approval
  
  // Customization Configuration (Asked first at registration & later editable in Settings)
  appName?: string;             // Customize MedRecord Pro
  companyLogo?: string;         // Base64 encoded company logo
  companyAddress?: string;      // Practice/Company physical address
  companyInfo?: string;         // Brief info, contact, registrations, etc.
  
  headlineAdmission?: string;   // "Patient Admission Record" / custom
  headlineDemographics?: string; // "1. Core Patient Demographics"
  headlineParameters?: string;  // "2. Clinical Parameters & Protocols"
  headlineRemarks?: string;     // "3. Admitting Practitioner Remarks"
  headlineFollowUpTitle?: string; // "4. Follow-Up Assessment Timeline"
  headlineSessionsTitle?: string; // "5. Treatment Sessions Ledger"
  printSectionsOrder?: string[];  // ['demographics', 'parameters', 'remarks', 'followups', 'sessions']
  
  labelPatientCode?: string;    // "Patient Code/ID"
  labelPatientName?: string;    // "Patient Full Name"
  labelAge?: string;            // "Patient Age"
  labelSex?: string;            // "Biological Sex"
  labelPhone?: string;          // "Contact Telephone"
  labelDiagnosis?: string;      // "Admitting Diagnosis"
  labelConsultant?: string;     // "Attending Consultant"
  labelTreatment?: string;      // "Active Treatment Protocol"
  labelRoute?: string;          // "Product Route"
  labelProcedurePlace?: string;  // "Procedure Place"
  labelAmount?: string;         // "Product Dosage"
  labelNotes?: string;          // "Practitioner Notes"
  appBgColor?: 'default' | 'sand' | 'mint' | 'lilac' | 'blueish' | 'stark';
  mandatoryFields?: string[];
  recoveryStatuses?: string[];
  activeSpreadsheetUrl?: string;
  whatsappWhitelist?: string[];
  whatsappEnabled?: boolean;
  telegramEnabled?: boolean;
  telegramBotToken?: string;
  telegramWhitelist?: string[];
  printSectionsIncluded?: string[];
  pdfHeaderLogo?: boolean;
  pdfHeaderDocId?: boolean;
  pdfHeaderConfidential?: boolean;
  pdfHeaderDate?: boolean;
  pdfFooterSignature?: boolean;
  pdfFooterPageNumber?: boolean;
  pdfFooterAddress?: boolean;
  pdfFooterWatermark?: boolean;
}

export interface ThemeOption {
  id: ThemeColor;
  name: string;
  primaryBg: string;       // BG class e.g. "bg-blue-600"
  primaryText: string;     // Text class e.g. "text-blue-600"
  accentBg: string;        // Ambient light accent bg "bg-blue-50/50"
  borderColor: string;     // Border color "border-blue-200"
  lightBorder: string;     // Lighter border "border-blue-100"
  badgeBgText: string;     // Active tab styling
  accentText: string;      // Color for labels/links
  indicatorBg: string;     // Notification dot color
  hoverBg: string;         // Hover effect class
  fillBg: string;          // Full color background tint
  isDark?: boolean;        // Is this a low-light dark slate theme?
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'blue',
    name: 'Secure Slate Blue',
    primaryBg: 'bg-blue-600 hover:bg-blue-700',
    primaryText: 'text-blue-600',
    accentBg: 'bg-blue-50/50',
    borderColor: 'border-blue-200/60',
    lightBorder: 'border-blue-100',
    badgeBgText: 'bg-blue-50 text-blue-700 border-blue-200/50',
    accentText: 'text-blue-700',
    indicatorBg: 'bg-blue-500',
    hoverBg: 'hover:bg-blue-50/60',
    fillBg: 'bg-blue-600/10'
  },
  {
    id: 'teal',
    name: 'Clinical Healing Teal',
    primaryBg: 'bg-teal-600 hover:bg-teal-700',
    primaryText: 'text-teal-600',
    accentBg: 'bg-teal-50/50',
    borderColor: 'border-teal-200/60',
    lightBorder: 'border-teal-100',
    badgeBgText: 'bg-teal-50 text-teal-700 border-teal-200/50',
    accentText: 'text-teal-700',
    indicatorBg: 'bg-teal-500',
    hoverBg: 'hover:bg-teal-50/60',
    fillBg: 'bg-teal-600/10'
  },
  {
    id: 'indigo',
    name: 'Tech Indigo',
    primaryBg: 'bg-indigo-600 hover:bg-indigo-700',
    primaryText: 'text-indigo-600',
    accentBg: 'bg-indigo-50/50',
    borderColor: 'border-indigo-200/60',
    lightBorder: 'border-indigo-100',
    badgeBgText: 'bg-indigo-50 text-indigo-700 border-indigo-200/50',
    accentText: 'text-indigo-700',
    indicatorBg: 'bg-indigo-500',
    hoverBg: 'hover:bg-indigo-50/60',
    fillBg: 'bg-indigo-600/10'
  },
  {
    id: 'rose',
    name: 'Cardiology Rose',
    primaryBg: 'bg-rose-600 hover:bg-rose-700',
    primaryText: 'text-rose-600',
    accentBg: 'bg-rose-50/50',
    borderColor: 'border-rose-200/60',
    lightBorder: 'border-rose-100',
    badgeBgText: 'bg-rose-50 text-rose-700 border-rose-200/50',
    accentText: 'text-rose-700',
    indicatorBg: 'bg-rose-500',
    hoverBg: 'hover:bg-rose-50/60',
    fillBg: 'bg-rose-600/10'
  },
  {
    id: 'emerald',
    name: 'Forest Emerald',
    primaryBg: 'bg-emerald-600 hover:bg-emerald-700',
    primaryText: 'text-emerald-600',
    accentBg: 'bg-emerald-50/50',
    borderColor: 'border-emerald-200/60',
    lightBorder: 'border-emerald-100',
    badgeBgText: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    accentText: 'text-emerald-700',
    indicatorBg: 'bg-emerald-500',
    hoverBg: 'hover:bg-emerald-50/60',
    fillBg: 'bg-emerald-600/10'
  },
  {
    id: 'slate',
    name: 'Professional Slate',
    primaryBg: 'bg-slate-700 hover:bg-slate-800',
    primaryText: 'text-slate-700',
    accentBg: 'bg-slate-100/50',
    borderColor: 'border-slate-300',
    lightBorder: 'border-slate-200/60',
    badgeBgText: 'bg-slate-100 text-slate-800 border-slate-300',
    accentText: 'text-slate-800',
    indicatorBg: 'bg-slate-600',
    hoverBg: 'hover:bg-slate-100/70',
    fillBg: 'bg-slate-700/10'
  },
  {
    id: 'dark',
    name: 'Clinical Dark Slate',
    primaryBg: 'bg-slate-800 hover:bg-slate-700',
    primaryText: 'text-slate-200',
    accentBg: 'bg-slate-850',
    borderColor: 'border-slate-750',
    lightBorder: 'border-slate-800',
    badgeBgText: 'bg-slate-800 text-slate-100 border-slate-700/80',
    accentText: 'text-slate-300',
    indicatorBg: 'bg-emerald-500',
    hoverBg: 'hover:bg-slate-800/80',
    fillBg: 'bg-slate-800/50',
    isDark: true
  }
];

export interface BgColorOption {
  id: 'default' | 'sand' | 'mint' | 'lilac' | 'blueish' | 'stark';
  name: string;
  lightBg: string;
  darkBg: string;
  colorDot: string;
}

export const BG_COLOR_OPTIONS: BgColorOption[] = [
  { id: 'default', name: 'Secure Slate Grey', lightBg: 'bg-[#FAFBFD]', darkBg: 'bg-slate-950', colorDot: 'bg-slate-400' },
  { id: 'sand', name: 'Warm Sand Cream', lightBg: 'bg-[#FDF8F2]', darkBg: 'bg-[#14120E]', colorDot: 'bg-amber-100/80 border border-amber-300/60' },
  { id: 'mint', name: 'Clinical Mint Glass', lightBg: 'bg-[#F2FBF5]', darkBg: 'bg-[#0A110E]', colorDot: 'bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300/60' },
  { id: 'lilac', name: 'Soothing Lilac Pearl', lightBg: 'bg-[#FCF2FC]', darkBg: 'bg-[#110A11]', colorDot: 'bg-purple-100 dark:bg-purple-950/50 border border-purple-300/40' },
  { id: 'blueish', name: 'Polar Ice Blue', lightBg: 'bg-[#F0F6FC]', darkBg: 'bg-[#0A1017]', colorDot: 'bg-blue-100 dark:bg-blue-950/50 border border-blue-300/40' },
  { id: 'stark', name: 'High-Contrast Stark', lightBg: 'bg-[#FFFFFF]', darkBg: 'bg-[#000000]', colorDot: 'bg-white border border-slate-350 dark:border-slate-800' }
];

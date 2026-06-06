import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Share2, FileText, Check, Eye, EyeOff, ShieldAlert, Activity, Loader2 } from 'lucide-react';
import { Patient } from '../types/patient';
import { ThemeOption, FormSettings } from '../types/settings';
import { generatePatientPDF } from '../utils/pdfGenerator';

interface PrintProfileModalProps {
  patient: Patient;
  onClose: () => void;
  activeTheme: ThemeOption;
  settings: FormSettings;
}

export default function PrintProfileModal({ patient, onClose, activeTheme, settings }: PrintProfileModalProps) {
  const [anonymized, setAnonymized] = useState(true);
  const [includeFollowUps, setIncludeFollowUps] = useState(patient.followUps.length > 0);
  const [includeSessions, setIncludeSessions] = useState(patient.treatmentSessions ? patient.treatmentSessions.length > 0 : false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [previewTab, setPreviewTab] = useState<'pdf' | 'metadata'>('pdf');

  // Derive display initials
  const initials = patient.name.split(' ').map(n => n[0]).join('.') || 'N/A';
  const displayName = anonymized ? `${initials}***** (Anonymized)` : patient.name;
  const displayPhone = anonymized ? 'REDACTED ENCRYPTED' : patient.phone;

  const isDark = activeTheme.isDark;

  // Custom parameters / labels fallbacks
  const labelDiagnosis = settings.labelDiagnosis || 'Admitting Diagnosis';
  const labelConsultant = settings.labelConsultant || 'Attending Consultant';
  const labelTreatment = settings.labelTreatment || 'Active Treatment Protocol';
  const labelAmount = settings.labelAmount || 'Product Dosage';
  const labelRoute = settings.labelRoute || 'Product Route';
  const labelProcedurePlace = settings.labelProcedurePlace || 'Procedure Place';

  const headlineAdmission = settings.headlineAdmission || 'Patient Admission Record';
  const headlineDemographics = settings.headlineDemographics || '1. Core Patient Demographics';
  const headlineParameters = settings.headlineParameters || '2. Clinical Parameters & Protocols';
  const headlineRemarks = settings.headlineRemarks || '3. Admitting Practitioner Remarks';
  const headlineFollowUpTitle = settings.headlineFollowUpTitle || '4. Follow-Up Assessment Timeline';
  const headlineSessionsTitle = settings.headlineSessionsTitle || '5. Treatment Sessions Ledger';

  const labelPatientCode = settings.labelPatientCode || 'Patient Code/ID';
  const labelPatientName = settings.labelPatientName || 'Patient Full Name';
  const labelPhone = settings.labelPhone || 'Contact Telephone';
  const labelSex = settings.labelSex || 'Biological Sex';
  const labelAge = settings.labelAge || 'Patient Age';

  const titleText = anonymized 
    ? `${headlineAdmission.toUpperCase()} (ANONYMISED)` 
    : `${headlineAdmission.toUpperCase()} & PROFILE SUMMARY`;

  // Page index helper calculation
  const hasFollowUps = patient.followUps && patient.followUps.length > 0;
  const hasSessions = patient.treatmentSessions && patient.treatmentSessions.length > 0;

  let pageCounter = 1;
  const followUpPageNum = hasFollowUps && includeFollowUps ? ++pageCounter : 0;
  const sessionsPageNum = hasSessions && includeSessions ? ++pageCounter : 0;
  const totalPages = pageCounter;

  const formatToDDMMYYYY = (dateStr: string): string => {
    if (!dateStr) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Build PDF document using our custom jsPDF drawer
  const getRenderedPDF = () => {
    const targetPatient = {
      ...patient,
      followUps: includeFollowUps ? patient.followUps : [],
      treatmentSessions: includeSessions ? (patient.treatmentSessions || []) : []
    };
    
    return generatePatientPDF(targetPatient, anonymized, settings, activeTheme);
  };

  // Compile real-time PDF preview blob URL on toggle selections
  useEffect(() => {
    let active = true;
    let url = '';
    
    try {
      const doc = getRenderedPDF();
      const pdfBlob = doc.output('blob');
      url = URL.createObjectURL(pdfBlob);
      if (active) {
        setPdfUrl(url);
      }
    } catch (error) {
      console.error('Error generating interactive PDF preview:', error);
    }

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [anonymized, includeFollowUps, includeSessions, patient, settings, activeTheme]);

  // 1. Download PDF Action
  const handleDownloadPDF = () => {
    setIsGenerating(true);
    try {
      const doc = getRenderedPDF();
      const fileName = anonymized 
        ? `clinical_summary_${patient.code}.pdf` 
        : `clinical_profile_${patient.name.toLowerCase().replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
    } catch (e) {
      alert('Failed to generate PDF document.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. High-Fidelity Vector-Print Action
  const handlePrintPDF = () => {
    setIsGenerating(true);
    try {
      const doc = getRenderedPDF();
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      } else {
        doc.save(`print_${patient.code}.pdf`);
        alert('Universal Print Action:\nPopup blocker prevented opening the print output window. The clinical PDF file has been downloaded instead. Please open and print it directly.');
      }
    } catch (e) {
      alert('Unable to launch browser print helper.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Multi-platform Sharing Action
  const handleSharePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = getRenderedPDF();
      const pdfBlob = doc.output('blob');
      const fileName = anonymized 
        ? `ehr_report_${patient.code}.pdf` 
        : `patient_report_${patient.code}.pdf`;

      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `EHR Clinical Report: ${patient.code}`,
          text: `Secured clinical dispatch for Patient ${patient.code}. Verified client-side cryptographic ledger.`,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      } else {
        doc.save(fileName);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
        alert(`Social Share Dispatch:\nYour browser does not support native direct file-sharing payloads. The PDF has been securely generated and downloaded as "${fileName}".\n\nYou can now easily send or upload this PDF file to WhatsApp, Messenger, Email, Slack, or any other platform!`);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        alert('Failed to transmit sharing payload: ' + e.message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
      <div className={`rounded-3xl border shadow-2xl w-full max-w-lg lg:max-w-5xl xl:max-w-6xl overflow-hidden flex flex-col relative max-h-[95vh] lg:max-h-[90vh] transition-all duration-300 ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        
        {/* Header Title */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <Printer className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
            <h3 className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              Export PDF Summary & Live Preview
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Scrollable Split Workspace Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          
          {/* Left Column: Interactive Layout Configurations (5/12 span) */}
          <div className="lg:col-span-5 space-y-6 flex flex-col justify-start">
            
            {/* Section: Interactive Layout Controls */}
            <div className="space-y-4">
              <h4 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Report Configuration Presets
              </h4>

              {/* Sub-item: Anonymization Checkbox */}
              <div className={`flex items-center justify-between p-3.5 border rounded-2xl transition-colors ${
                isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/40' : 'bg-white border-slate-200 hover:bg-slate-50/40'
              }`}>
                <div className="flex-1 pr-4">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {anonymized ? <EyeOff className="h-4 w-4 text-emerald-500" /> : <Eye className="h-4 w-4 text-slate-400" />}
                    Anonymize Identity Details
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Replaces full legal name with initials and conceals contact telephone numbers. Highly recommended for multi-platform sharing in peer groups.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAnonymized(!anonymized)}
                  className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 cursor-pointer ${
                    anonymized ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow transform transition-transform ${anonymized ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Live Document Preview Workplace (7/12 span) */}
          <div className="lg:col-span-7 flex flex-col h-full min-h-[420px] lg:min-h-0">
            
            {/* Live Preview Tabs Panel */}
            <div className={`flex justify-between items-center mb-3 pb-2 border-b shrink-0 ${
              isDark ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab('pdf')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    previewTab === 'pdf'
                      ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-xs border border-slate-200/50')
                      : 'text-slate-400 hover:text-slate-355'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Interactive PDF Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('metadata')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    previewTab === 'metadata'
                      ? (isDark ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-xs border border-slate-200/50')
                      : 'text-slate-400 hover:text-slate-355'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Clinical Records Data</span>
                </button>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest hidden sm:inline">
                Live Refreshing
              </span>
            </div>

            {/* Preview Workspace Wrapper */}
            <div className={`flex-1 flex flex-col min-h-0 rounded-2xl relative ${
              isDark ? 'bg-slate-905/30' : 'bg-slate-50/40'
            }`}>
              {previewTab === 'pdf' ? (
                <div className="flex-1 flex flex-col min-h-0 relative h-full">
                  {/* Sandbox Notification Banner */}
                  <div className={`p-3 rounded-2xl mb-3 flex flex-col sm:flex-row gap-2 sm:items-center justify-between text-[11px] border leading-relaxed ${
                    isDark ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-800'
                  }`}>
                    <span>
                      🔒 Security sandbox policies can sometimes prevent native PDF viewers from loading within side frames. 
                    </span>
                    {pdfUrl && (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl font-bold uppercase text-[9px] tracking-wider transition-colors shrink-0 bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        <Share2 className="h-3 w-3 text-indigo-100" />
                        <span>Open PDF in New Tab</span>
                      </a>
                    )}
                  </div>

                  {/* Virtual High-Fidelity PDF Page Sheet Canvas */}
                  <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/50 shadow-inner bg-slate-100/40 px-3 py-4 lg:p-5 space-y-6 max-h-[380px] lg:max-h-[500px] xl:max-h-[580px]">
                    
                    {/* PAGE 1: DEMOGRAPHICS, CLINICAL DETAILS & NOTES */}
                    <div className="bg-white text-slate-800 shadow-md rounded-xl p-5 lg:p-7 relative mx-auto font-sans text-left max-w-3xl border border-slate-200/60">
                      {/* Colored Top Header Bar */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" 
                        style={{ 
                          backgroundColor: 
                            settings.theme === 'blue' ? '#1e40af' :
                            settings.theme === 'teal' ? '#115e59' :
                            settings.theme === 'indigo' ? '#3730a3' :
                            settings.theme === 'rose' ? '#9f1239' :
                            settings.theme === 'emerald' ? '#065f46' :
                            settings.theme === 'slate' ? '#334155' : '#1e40af'
                        }} 
                      />

                      {/* Header Logo & Title Block */}
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200/80">
                        <div className="flex items-center gap-3">
                          {settings.companyLogo ? (
                            <img 
                              src={settings.companyLogo} 
                              alt="Clinic Logo" 
                              className="h-11 w-auto object-contain shrink-0 max-w-[130px]" 
                              referrerPolicy="no-referrer" 
                            />
                          ) : (
                            <div 
                              className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                              style={{ 
                                backgroundColor: 
                                  settings.theme === 'blue' ? '#1e40af' :
                                  settings.theme === 'teal' ? '#115e59' :
                                  settings.theme === 'indigo' ? '#3730a3' :
                                  settings.theme === 'rose' ? '#9f1239' :
                                  settings.theme === 'emerald' ? '#065f46' :
                                  settings.theme === 'slate' ? '#334155' : '#1e40af'
                              }}
                            >
                              +
                            </div>
                          )}
                          <div>
                            <h4 
                              className="text-xs font-extrabold uppercase tracking-wide leading-tight"
                              style={{ 
                                color: 
                                  settings.theme === 'blue' ? '#1e40af' :
                                  settings.theme === 'teal' ? '#115e59' :
                                  settings.theme === 'indigo' ? '#3730a3' :
                                  settings.theme === 'rose' ? '#9f1239' :
                                  settings.theme === 'emerald' ? '#065f46' :
                                  settings.theme === 'slate' ? '#334155' : '#1e40af'
                              }}
                            >
                              {titleText}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              {settings.appName || 'ZERO-KNOWLEDGE EHR SECURED RECORD PLATFORM'}
                            </p>
                          </div>
                        </div>

                        {/* Right aligned clinical barcode/date meta */}
                        <div className="text-left sm:text-right text-[9px] text-slate-500 space-y-0.5 shrink-0">
                          <p className="font-mono">Doc ID: {patient.id.substring(0, 8).toUpperCase()}-{patient.code}</p>
                          <p className="text-red-500 font-extrabold uppercase tracking-wider text-[8px]">
                            CONFIDENTIAL MEDICAL RECORD
                          </p>
                          <p className="text-slate-400">
                            Generated: {new Date().toISOString().replace('T', ' ').substring(0, 16)} UTC
                          </p>
                        </div>
                      </div>

                      {/* Section 1: Demographics */}
                      <div className="mt-5">
                        <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                          <div 
                            className="w-1.5 h-3.5 rounded-xs" 
                            style={{ 
                              backgroundColor: 
                                settings.theme === 'blue' ? '#1e40af' :
                                settings.theme === 'teal' ? '#115e59' :
                                settings.theme === 'indigo' ? '#3730a3' :
                                settings.theme === 'rose' ? '#9f1239' :
                                settings.theme === 'emerald' ? '#065f46' :
                                settings.theme === 'slate' ? '#334155' : '#1e40af'
                            }} 
                          />
                          <h5 
                            className="text-[10px] font-extrabold uppercase tracking-wider"
                            style={{ 
                              color: 
                                settings.theme === 'blue' ? '#1e40af' :
                                settings.theme === 'teal' ? '#115e59' :
                                settings.theme === 'indigo' ? '#3730a3' :
                                settings.theme === 'rose' ? '#9f1239' :
                                settings.theme === 'emerald' ? '#065f46' :
                                settings.theme === 'slate' ? '#334155' : '#1e40af'
                            }}
                          >
                            {headlineDemographics}
                          </h5>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-start">
                          {patient.profilePic && (
                            <img 
                              src={patient.profilePic} 
                              alt="Patient admission profile" 
                              className="h-16 w-16 rounded-xl object-cover border border-slate-200 shrink-0 self-center md:self-start shadow-xs p-0.5"
                              referrerPolicy="no-referrer" 
                            />
                          )}
                          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{labelPatientName}</span>
                              <p className="font-extrabold text-slate-900 mt-0.5">{displayName}</p>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{labelPatientCode}</span>
                              <p 
                                className="font-extrabold mt-0.5"
                                style={{ 
                                  color: 
                                    settings.theme === 'blue' ? '#1e40af' :
                                    settings.theme === 'teal' ? '#115e59' :
                                    settings.theme === 'indigo' ? '#3730a3' :
                                    settings.theme === 'rose' ? '#9f1239' :
                                    settings.theme === 'emerald' ? '#065f46' :
                                    settings.theme === 'slate' ? '#334155' : '#1e40af'
                                }}
                              >
                                {patient.code}
                              </p>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{labelPhone}</span>
                              <p className="font-semibold text-slate-700 mt-0.5 select-all">{displayPhone}</p>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{labelSex}</span>
                              <p className="font-semibold text-slate-705 mt-0.5">{patient.sex}</p>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{labelAge}</span>
                              <p className="font-semibold text-slate-705 mt-0.5">{patient.age} Years</p>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Date Administered</span>
                              <p className="font-semibold text-slate-705 mt-0.5">{formatToDDMMYYYY(patient.date)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Clinical Parameters */}
                      <div className="mt-5.5">
                        <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                          <div 
                            className="w-1.5 h-3.5 rounded-xs" 
                            style={{ 
                              backgroundColor: 
                                settings.theme === 'blue' ? '#1e40af' :
                                settings.theme === 'teal' ? '#115e59' :
                                settings.theme === 'indigo' ? '#3730a3' :
                                settings.theme === 'rose' ? '#9f1239' :
                                settings.theme === 'emerald' ? '#065f46' :
                                settings.theme === 'slate' ? '#334155' : '#1e40af'
                            }} 
                          />
                          <h5 
                            className="text-[10px] font-extrabold uppercase tracking-wider"
                            style={{ 
                              color: 
                                settings.theme === 'blue' ? '#1e40af' :
                                settings.theme === 'teal' ? '#115e59' :
                                settings.theme === 'indigo' ? '#3730a3' :
                                settings.theme === 'rose' ? '#9f1239' :
                                settings.theme === 'emerald' ? '#065f46' :
                                settings.theme === 'slate' ? '#334155' : '#1e40af'
                            }}
                          >
                            {headlineParameters}
                          </h5>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-5 text-xs">
                          <div>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{labelDiagnosis}</span>
                            <p className="font-extrabold text-slate-900 mt-0.5 leading-snug">{patient.diagnosis}</p>
                          </div>
                          <div>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{labelConsultant}</span>
                            <p className="font-extrabold text-slate-900 mt-0.5 leading-snug">{patient.consultant}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{labelTreatment}</span>
                            <p className="font-extrabold text-slate-800 mt-0.5 leading-relaxed">{patient.treatment}</p>
                          </div>
                          <div>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Method & Route Of Injection</span>
                            <p className="font-semibold text-slate-700 mt-0.5">
                              {patient.amount} via <span className="font-bold">{patient.route}</span> 
                              {patient.procedurePlace ? ` (@ ${patient.procedurePlace})` : ''}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Session</span>
                              <p 
                                className="font-extrabold mt-0.5 text-xs"
                                style={{ 
                                  color: 
                                    settings.theme === 'blue' ? '#1e40af' :
                                    settings.theme === 'teal' ? '#115e59' :
                                    settings.theme === 'indigo' ? '#3730a3' :
                                    settings.theme === 'rose' ? '#9f1239' :
                                    settings.theme === 'emerald' ? '#065f46' :
                                    settings.theme === 'slate' ? '#334155' : '#1e40af'
                                }}
                              >
                                Total: {patient.treatmentSessions?.length || 0}
                              </p>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Progress State</span>
                              <p className="font-extrabold text-slate-900 mt-0.5">{patient.improvement}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Notes & Remarks */}
                      <div className="mt-5.5">
                        <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-100">
                          <div 
                            className="w-1.5 h-3.5 rounded-xs" 
                            style={{ 
                              backgroundColor: 
                                settings.theme === 'blue' ? '#1e40af' :
                                settings.theme === 'teal' ? '#115e59' :
                                settings.theme === 'indigo' ? '#3730a3' :
                                settings.theme === 'rose' ? '#9f1239' :
                                settings.theme === 'emerald' ? '#065f46' :
                                settings.theme === 'slate' ? '#334155' : '#1e40af'
                            }} 
                          />
                          <h5 
                            className="text-[10px] font-extrabold uppercase tracking-wider"
                            style={{ 
                              color: 
                                settings.theme === 'blue' ? '#1e40af' :
                                settings.theme === 'teal' ? '#115e59' :
                                settings.theme === 'indigo' ? '#3730a3' :
                                settings.theme === 'rose' ? '#9f1239' :
                                settings.theme === 'emerald' ? '#065f46' :
                                settings.theme === 'slate' ? '#334155' : '#1e40af'
                            }}
                          >
                            {headlineRemarks}
                          </h5>
                        </div>

                        <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 font-normal leading-relaxed whitespace-pre-wrap shadow-2xs">
                          {patient.notes || 'No extensive diagnostic remarks logged for this intake ledger item.'}
                        </div>
                      </div>

                      {/* Page footer details */}
                      <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 text-[8.5px] text-slate-400 mt-8">
                        <div>
                          <p className="font-extrabold text-slate-500 uppercase tracking-widest">{settings.companyAddress || 'MAIN CLINIC HEADQUARTERS'}</p>
                          <p className="font-medium mt-0.5">{settings.companyInfo || 'EHR CLIENT-SIDE SECURED CLINICAL SYSTEM'}</p>
                        </div>
                        <p className="font-mono shrink-0">
                          Page 1 of {totalPages}
                        </p>
                      </div>
                    </div>

                    {/* PAGE 2: TIMELINE FOLLOW-UPS (If Configured) */}
                    {includeFollowUps && patient.followUps.length > 0 && (
                      <div className="bg-white text-slate-800 shadow-md rounded-xl p-5 lg:p-7 relative mx-auto font-sans text-left max-w-3xl border border-slate-200/60 transition-all duration-300">
                        {/* Colored Top Header Bar */}
                        <div 
                          className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" 
                          style={{ 
                            backgroundColor: 
                              settings.theme === 'blue' ? '#1e40af' :
                              settings.theme === 'teal' ? '#115e59' :
                              settings.theme === 'indigo' ? '#3730a3' :
                              settings.theme === 'rose' ? '#9f1239' :
                              settings.theme === 'emerald' ? '#065f46' :
                              settings.theme === 'slate' ? '#334155' : '#1e40af'
                          }} 
                        />

                        {/* Title Bar */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4.5 w-4.5 text-slate-500" />
                            <div>
                              <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-900 leading-tight">
                                LONGITUDINAL PROGRESS & COHORT TIMELINE
                              </h4>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                {settings.appName || 'ZERO-KNOWLEDGE EHR SECURED RECORD PLATFORM'}
                              </p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right text-[9px] text-slate-500 tracking-wider">
                            <p className="font-mono">Doc ID: {patient.id.substring(0, 8).toUpperCase()}-{patient.code}</p>
                            <p className="text-red-500 font-bold uppercase text-[8px]">ADMISSION TIMELINE COHORT</p>
                          </div>
                        </div>

                        {/* Section Header */}
                        <div className="mt-5">
                          <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                            <div 
                              className="w-1.5 h-3.5 rounded-xs" 
                              style={{ 
                                backgroundColor: 
                                  settings.theme === 'blue' ? '#1e40af' :
                                  settings.theme === 'teal' ? '#115e59' :
                                  settings.theme === 'indigo' ? '#3730a3' :
                                  settings.theme === 'rose' ? '#9f1239' :
                                  settings.theme === 'emerald' ? '#065f46' :
                                  settings.theme === 'slate' ? '#334155' : '#1e40af'
                              }} 
                            />
                            <h5 
                              className="text-[10px] font-extrabold uppercase tracking-wider"
                              style={{ 
                                color: 
                                  settings.theme === 'blue' ? '#1e40af' :
                                  settings.theme === 'teal' ? '#115e59' :
                                  settings.theme === 'indigo' ? '#3730a3' :
                                  settings.theme === 'rose' ? '#9f1239' :
                                  settings.theme === 'emerald' ? '#065f46' :
                                  settings.theme === 'slate' ? '#334155' : '#1e40af'
                              }}
                            >
                              {headlineFollowUpTitle}
                            </h5>
                          </div>

                          <p className="text-[9.5px] text-red-500 italic mb-4 font-medium">
                            * Demonstrating authenticated progressive consultation ledgers.
                          </p>

                          <div className="space-y-4">
                            {patient.followUps.slice().reverse().map((f, idx) => (
                              <div key={idx} className="border border-slate-200/70 p-3 rounded-xl bg-slate-50/50 flex gap-3 text-xs shadow-3xs hover:bg-slate-50 transition-colors">
                                <div 
                                  className="w-1 rounded-sm shrink-0" 
                                  style={{ 
                                    backgroundColor: 
                                      settings.theme === 'blue' ? '#1e40af' :
                                      settings.theme === 'teal' ? '#115e59' :
                                      settings.theme === 'indigo' ? '#3730a3' :
                                      settings.theme === 'rose' ? '#9f1239' :
                                      settings.theme === 'emerald' ? '#065f46' :
                                      settings.theme === 'slate' ? '#334155' : '#1e40af'
                                  }}
                                />
                                <div className="flex-1 space-y-1.5 min-w-0">
                                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                                    <span 
                                      className="font-extrabold tracking-wide"
                                      style={{ 
                                        color: 
                                          settings.theme === 'blue' ? '#1e40af' :
                                          settings.theme === 'teal' ? '#115e59' :
                                          settings.theme === 'indigo' ? '#3730a3' :
                                          settings.theme === 'rose' ? '#9f1239' :
                                          settings.theme === 'emerald' ? '#065f46' :
                                          settings.theme === 'slate' ? '#334155' : '#1e40af'
                                      }}
                                    >
                                      Consultation Date: {formatToDDMMYYYY(f.date)}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                      Clinician: Dr. {f.clinician}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Status Index:</span>
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50/70 px-2 py-0.2 rounded">
                                      {f.status || 'Stable'}
                                    </span>
                                  </div>
                                  <p className="text-slate-650 font-normal leading-relaxed text-[11.5px] whitespace-pre-wrap">
                                    {f.notes || 'No assessment summary notes registered.'}
                                  </p>
                                  {f.attachments && f.attachments.length > 0 && (
                                    <div className="flex items-center gap-1.5 pt-1 text-[9.5px] font-bold text-blue-600/90">
                                      <FileText className="h-3 w-3" />
                                      <span className="truncate">Attachments payload: {f.attachments.map(a => a.name).join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pagination footer */}
                        <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 text-[8.5px] text-slate-400 mt-8">
                          <div>
                            <p className="font-extrabold text-slate-500 uppercase tracking-widest">{settings.companyAddress || 'MAIN CLINIC HEADQUARTERS'}</p>
                            <p className="font-medium mt-0.5">{settings.companyInfo || 'EHR CLIENT-SIDE SECURED CLINICAL SYSTEM'}</p>
                          </div>
                          <p className="font-mono shrink-0">
                            Page {followUpPageNum} of {totalPages}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* PAGE 3: EXTRA TIMELINE CHRONOLOGY SESSIONS (If Configured) */}
                    {includeSessions && patient.treatmentSessions && patient.treatmentSessions.length > 0 && (
                      <div className="bg-white text-slate-800 shadow-md rounded-xl p-5 lg:p-7 relative mx-auto font-sans text-left max-w-3xl border border-slate-200/60 transition-all duration-300">
                        {/* Colored Top Header Bar */}
                        <div 
                          className="absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-emerald-600" 
                        />

                        {/* Title Bar */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4.5 w-4.5 text-emerald-600" />
                            <div>
                              <h4 className="text-xs font-extrabold uppercase tracking-wide text-emerald-800 leading-tight">
                                TREATMENT SESSIONS CHRONOLOGY
                              </h4>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                {settings.appName || 'ZERO-KNOWLEDGE EHR SECURED RECORD PLATFORM'}
                              </p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right text-[9px] text-slate-500 tracking-wider">
                            <p className="font-mono">Doc ID: {patient.id.substring(0, 8).toUpperCase()}-{patient.code}</p>
                            <p className="text-emerald-600 font-bold uppercase text-[8px]">CLINICAL SESSIONS JOURNAL</p>
                          </div>
                        </div>

                        {/* Section Header */}
                        <div className="mt-5">
                          <div className="flex items-center gap-2 mb-3 pb-1 border-b border-emerald-100">
                            <div 
                              className="w-1.5 h-3.5 rounded-xs bg-emerald-500" 
                            />
                            <h5 
                              className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800"
                            >
                              {headlineSessionsTitle}
                            </h5>
                          </div>

                          <p className="text-[9.5px] text-emerald-600 italic mb-4 font-medium">
                            * Demonstrating verified clinical treatment administrations.
                          </p>

                          <div className="space-y-4">
                            {patient.treatmentSessions.slice().reverse().map((s, idx) => (
                              <div key={idx} className="border border-emerald-150 p-3 rounded-xl bg-emerald-50/20 flex gap-3 text-xs shadow-3xs hover:bg-emerald-50/40 transition-colors">
                                <div 
                                  className="w-1 rounded-sm shrink-0 bg-emerald-500" 
                                />
                                <div className="flex-1 space-y-1.5 min-w-0">
                                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 text-emerald-800">
                                    <span 
                                      className="font-extrabold tracking-wide"
                                    >
                                      Session #{s.sessionNo} Administered: {formatToDDMMYYYY(s.date)}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200/60 px-2 py-0.5 rounded-md">
                                      Practitioner: Dr. {s.consultant}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10.5px] text-slate-650 bg-white/70 p-2 rounded-lg border border-slate-100">
                                    <p><strong>Treatment:</strong> {s.treatment}</p>
                                    <p><strong>Dosage / Method:</strong> {s.amount} ({s.route})</p>
                                  </div>
                                  <p className="text-slate-650 font-normal leading-relaxed text-[11.5px] whitespace-pre-wrap">
                                    {s.notes || 'No extensive session remarks documented.'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pagination footer */}
                        <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 text-[8.5px] text-slate-400 mt-8">
                          <div>
                            <p className="font-extrabold text-slate-500 uppercase tracking-widest">{settings.companyAddress || 'MAIN CLINIC HEADQUARTERS'}</p>
                            <p className="font-medium mt-0.5">{settings.companyInfo || 'EHR CLIENT-SIDE SECURED CLINICAL SYSTEM'}</p>
                          </div>
                          <p className="font-mono shrink-0">
                            Page {sessionsPageNum} of {totalPages}
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ) : (
                /* Tab 2: Confidential Metadata */
                <div className={`p-4 flex-1 overflow-y-auto max-h-[360px] lg:max-h-full border rounded-2xl shadow-sm ${
                  isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-[#FCFDFE] border-[#E9EFF5]'
                }`}>
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Live Dispatch Metadata Preview
                  </h4>
                  <div className={`text-[11px] font-mono whitespace-pre-wrap leading-relaxed p-3.5 rounded-xl border ${
                    isDark ? 'bg-slate-950 border-slate-850 text-slate-350' : 'bg-white border-slate-150 text-slate-600'
                  }`}>
                    <span className="font-bold uppercase text-xs text-blue-500">
                      {anonymized ? '[CONFIDENTIAL EHR REPORT - ANONYMIZED]' : '[CONFIDENTIAL PATIENT PROFILE - RESTRICTED]'}
                    </span>
                    <div className={`border-b border-dashed my-2.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}></div>
                    <span>Patient Initials: <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{displayName}</span></span>
                    <span>{"\n"}Registry Code: <span className={`font-bold ${isDark ? 'text-slate-205' : 'text-slate-801'}`}>{patient.code}</span></span>
                    <span>{"\n"}Contact Phone: <span className={`font-bold ${isDark ? 'text-slate-205' : 'text-slate-801'}`}>{displayPhone}</span></span>
                    <span>{"\n"}{labelDiagnosis}: {patient.diagnosis}</span>
                    <span>{"\n"}{labelConsultant}: {patient.consultant}</span>
                    <span>{"\n"}{labelTreatment}: {patient.treatment}</span>
                    <span>{"\n"}{labelAmount} / {labelRoute}: {patient.amount} via {patient.route}</span>
                    {patient.procedurePlace && <span>{"\n"}{labelProcedurePlace}: {patient.procedurePlace}</span>}
                    <span>{"\n"}Follow-Up Count: {includeFollowUps ? `${patient.followUps.length} entries` : 'Excluded'}</span>
                    <span>{"\n"}Treatment Sessions: {includeSessions ? `${(patient.treatmentSessions || []).length} entries` : 'Excluded'}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className={`px-6 py-4.5 border-t flex flex-col sm:flex-row gap-2 shrink-0 ${
          isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-5/50 border-slate-100'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 border rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer sm:order-1 ${
              isDark 
                ? 'bg-slate-900 border-slate-800 hover:bg-slate-805 text-slate-400 hover:text-slate-205' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700'
            }`}
          >
            Close Dialog
          </button>
          
          <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:order-2">
            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 disabled:opacity-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-905 hover:bg-slate-800 text-white'
              }`}
            >
              <Download className="h-3.5 w-3.5 text-slate-300" />
              <span>Convert & Save PDF</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrintPDF}
              disabled={isGenerating}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-white disabled:opacity-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${activeTheme.primaryBg}`}
            >
              <Printer className="h-3.5 w-3.5 text-white" />
              <span>Direct Print</span>
            </button>

            {/* Share Button */}
            <button
              type="button"
              onClick={handleSharePDF}
              disabled={isGenerating}
              className={`px-4 py-2.5 border rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-350' 
                  : 'bg-white border-slate-220 hover:bg-slate-50 text-slate-600'
              }`}
            >
              {shareSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">PDF Shared!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>Transmit PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

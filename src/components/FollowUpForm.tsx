import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clipboard, 
  ShieldAlert, 
  Plus, 
  User, 
  Hash, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  CalendarDays,
  Activity,
  HeartPulse,
  History,
  Paperclip,
  Trash2,
  Upload,
  Info,
  ArrowUpDown
} from 'lucide-react';
import { Patient, FollowUp, PatientAttachment } from '../types/patient';
import { FormSettings, ThemeOption } from '../types/settings';

interface FollowUpFormProps {
  patients: Patient[];
  preselectedPatientId?: string;
  onAddFollowUp: (patientId: string, followUp: Omit<FollowUp, 'id'>) => void;
  onCancel?: () => void;
  settings: FormSettings;
  activeTheme: ThemeOption;
  onUpdateSettings?: (settings: FormSettings) => void;
  onUpdatePatient: (updated: Patient) => void;
  userRole?: string;
}

const RECOVERY_STATUSES = [
  'Stable / Maintenance Protocol',
  'Significantly Improved - Ready for Discharge Protocol',
  'Gradual Improvement Observed',
  'No Changes (Symptomatic Plateau)',
  'Minor Flareups / Temporary Regression',
  'Deteriorated / Urgent Re-assessment Required',
];

interface ScheduledEvent {
  patient: Patient;
  sessionNo: number;
  label: string;
  targetDate: string;
  isCompleted: boolean;
  statusText: 'overdue' | 'today' | 'upcoming';
  daysDiffText: string;
}

// Safer local date calculators to ignore timezone discrepancies
function addDaysLocal2(dateStr: string, days: number): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    d.setDate(d.getDate() + days);
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    return dateStr;
  }
}

function getTodayStr2(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDaysDiffText(targetDate: string, todayDate: string): { text: string; days: number } {
  try {
    const tParts = targetDate.split('-');
    const oParts = todayDate.split('-');
    if (tParts.length !== 3 || oParts.length !== 3) return { text: '', days: 0 };
    
    const tTime = new Date(parseInt(tParts[0], 10), parseInt(tParts[1], 10) - 1, parseInt(tParts[2], 10)).getTime();
    const oTime = new Date(parseInt(oParts[0], 10), parseInt(oParts[1], 10) - 1, parseInt(oParts[2], 10)).getTime();
    const diffMs = tTime - oTime;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return { text: 'Due today', days: 0 };
    if (diffDays === 1) return { text: 'Tomorrow', days: 1 };
    if (diffDays === -1) return { text: '1 day overdue', days: -1 };
    if (diffDays > 1) return { text: `In ${diffDays} days`, days: diffDays };
    return { text: `${Math.abs(diffDays)} days overdue`, days: diffDays };
  } catch (e) {
    return { text: '', days: 0 };
  }
}

/**
 * Automatically increments the sessionNo for a patient's next follow-up
 * based on their existing followUps array length.
 */
export function getNextFollowUpSessionNo(patient: Patient): number {
  return (patient.followUps ? patient.followUps.length : 0) + 1;
}

function getBangladeshDateTime(): { dateStr: string; timeStr: string } {
  try {
    const d = new Date();
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
    const bdDate = new Date(utcMs + 3600000 * 6);
    
    const dd = String(bdDate.getDate()).padStart(2, '0');
    const mm = String(bdDate.getMonth() + 1).padStart(2, '0');
    const yyyy = bdDate.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    let hours = bdDate.getHours();
    const minutes = String(bdDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;
    
    return { dateStr, timeStr };
  } catch (e) {
    return { dateStr: '', timeStr: '' };
  }
}

export default function FollowUpForm({ 
  patients, 
  preselectedPatientId, 
  onAddFollowUp, 
  onCancel, 
  settings, 
  activeTheme,
  onUpdatePatient,
  userRole
}: FollowUpFormProps) {
  const [patientId, setPatientId] = useState(preselectedPatientId || (patients[0]?.id ?? ''));
  const [date, setDate] = useState(() => getTodayStr2());
  const [status, setStatus] = useState(() => {
    const opts = settings.recoveryStatuses || RECOVERY_STATUSES;
    return opts.includes('Gradual Improvement Observed') ? 'Gradual Improvement Observed' : (opts[0] || '');
  });
  const [notes, setNotes] = useState('');
  const [clinician, setClinician] = useState('');
  const [customClinician, setCustomClinician] = useState('');
  const [sessionNo, setSessionNo] = useState<number>(1);
  const [schedulerFilter, setSchedulerFilter] = useState<'today' | 'pending' | 'upcoming' | 'completed'>('today');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [hasSetInitialFilter, setHasSetInitialFilter] = useState(false);
  const [attachments, setAttachments] = useState<PatientAttachment[]>([]);
  const [bdDateTime, setBdDateTime] = useState(() => getBangladeshDateTime());
  const [activeFormTab, setActiveFormTab] = useState<'form' | 'scheduler'>(() => {
    return userRole === 'user' ? 'scheduler' : 'form';
  });

  useEffect(() => {
    if (userRole === 'user') {
      setActiveFormTab('scheduler');
    }
  }, [userRole]);

  useEffect(() => {
    if (preselectedPatientId && userRole !== 'user') {
      setPatientId(preselectedPatientId);
      setActiveFormTab('form');
    }
  }, [preselectedPatientId, userRole]);

  useEffect(() => {
    const timer = setInterval(() => {
      setBdDateTime(getBangladeshDateTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const selectedPatient = patients.find((p) => p.id === patientId);
  const isDark = activeTheme.isDark;

  const todayStr = useMemo(() => getTodayStr2(), []);

  // Compute scheduled pipeline events of all active patients
  const scheduledEvents = useMemo(() => {
    const list: ScheduledEvent[] = [];

    patients.forEach((p) => {
      // Keep an option during entry of patients if patient are to be follow up or not
      if (p.requiresFollowUp === false) {
        return;
      }

      // Determine base clinical treatment date as fallback if empty (count new schedule from last treatment date)
      const baseDate = p.date || p.createdAt?.split('T')[0] || todayStr;

      // Follow-up offsets: Day 1, and repeating every 30 days up to 6 months
      const schedules = [
        { offset: 1, session: 1, label: 'Day 1 Post-Treatment' },
        { offset: 31, session: 2, label: 'Month 1 Follow-Up' },
        { offset: 61, session: 3, label: 'Month 2 Follow-Up' },
        { offset: 91, session: 4, label: 'Month 3 Follow-Up' },
        { offset: 121, session: 5, label: 'Month 4 Follow-Up' },
        { offset: 151, session: 6, label: 'Month 5 Follow-Up' },
        { offset: 181, session: 7, label: 'Month 6 Follow-Up' },
      ];

      schedules.forEach((sch) => {
        const targetDate = addDaysLocal2(baseDate, sch.offset);
        const { text: daysDiffText } = getDaysDiffText(targetDate, todayStr);

        // A scheduled session is completed if there's a logged follow-up with matching sessionNo and treatmentSessionNo
        const isCompleted = p.followUps.some((f) => {
          // If the patient has multiple treatment sessions (>1), we check if the logged follow-up matches this current session
          // For legacy profiles, if they have no treatmentSessionNo or p.sessionNo is 1 we count them as matched.
          const belongsToCurrentSession = f.treatmentSessionNo
            ? f.treatmentSessionNo === p.sessionNo
            : p.sessionNo <= 1;
          return belongsToCurrentSession && f.sessionNo === sch.session;
        });

        let statusText: 'overdue' | 'today' | 'upcoming' = 'upcoming';
        if (targetDate === todayStr) {
          statusText = 'today';
        } else if (targetDate < todayStr) {
          statusText = 'overdue';
        }

        list.push({
          patient: p,
          sessionNo: sch.session,
          label: sch.label,
          targetDate,
          isCompleted,
          statusText,
          daysDiffText,
        });
      });
    });

    return list;
  }, [patients, todayStr]);

  // Split scheduled events into categoric queues
  const todaysFollowups = useMemo(() => {
    return scheduledEvents.filter(e => e.statusText === 'today' && !e.isCompleted);
  }, [scheduledEvents]);

  const pendingFollowups = useMemo(() => {
    return scheduledEvents.filter(e => e.statusText === 'overdue' && !e.isCompleted);
  }, [scheduledEvents]);

  const upcomingFollowups = useMemo(() => {
    return scheduledEvents.filter(e => e.statusText === 'upcoming' && !e.isCompleted);
  }, [scheduledEvents]);

  const completedFollowups = useMemo(() => {
    return scheduledEvents.filter(e => e.isCompleted);
  }, [scheduledEvents]);

  // Adjust active tab dynamically if standard queue is empty on initial load to avoid starting on an empty view
  useEffect(() => {
    if (!hasSetInitialFilter && todaysFollowups.length === 0 && pendingFollowups.length > 0) {
      setSchedulerFilter('pending');
      setHasSetInitialFilter(true);
    } else if (patients.length > 0) {
      setHasSetInitialFilter(true);
    }
  }, [todaysFollowups, pendingFollowups, patients, hasSetInitialFilter]);

  // Trigger when doctor selects a scheduled task card
  const handleSelectScheduledEvent = (event: ScheduledEvent) => {
    setPatientId(event.patient.id);
    setSessionNo(event.sessionNo);
    setDate(todayStr); // Reset log clinical record date to system's true today
    setActiveFormTab('form');
    
    const suggestedTemplates: Record<number, string> = {
      1: `Day 1 follow-up physical examination.\n- Patient reported immediate postoperative indicators:\n- Vital signs: \n- Incision/administration site assessment: clean/dry/intact\n- Next steps: `,
      2: `Month 1 routine wellness clinical visit.\n- Therapeutic progress status:\n- Localized swelling / joint flexibility flexion degrees:\n- Medication compliance status:\n- Recommendations: `,
      3: `Month 2 diagnostic response monitoring.\n- Active treatment evaluation:\n- Pain scale response (NRS /10):\n- Adverse events or symptoms reported:\n- Action items: `,
      4: `Month 3 core progress evaluation.\n- Halfway protocol evaluation review:\n- Physical motility indices:\n- Primary consultant updates:\n- Future scheduling adjustments: `,
    };

    const suggested = suggestedTemplates[event.sessionNo] || `${event.label} assessment report.\n- Clinical status notes:\n- Next milestone review: `;
    setNotes(suggested);

    // Auto focus and smooth scroll to the observations textarea
    setTimeout(() => {
      const observerInput = document.getElementById('followup_notes');
      if (observerInput) {
        observerInput.focus();
        observerInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Dynamic next session auto-calculation fallback using helper function
  useEffect(() => {
    if (selectedPatient) {
      setSessionNo(getNextFollowUpSessionNo(selectedPatient));
    }
  }, [patientId, selectedPatient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientId) {
      alert('Clinical Error: You must specify a patient to file a follow-up.');
      return;
    }

    const finalClinician = clinician === 'Other' || !clinician ? customClinician.trim() : clinician;

    if (!notes.trim() || !finalClinician) {
      alert('Please fill out all required assessment fields.');
      return;
    }

    onAddFollowUp(patientId, {
      date,
      status,
      notes: notes.trim(),
      clinician: finalClinician,
      sessionNo: Number(sessionNo),
      treatmentSessionNo: selectedPatient?.sessionNo || 1, // associate with the active treatment session
      attachments
    });

    // Reset notes and attachments after registration
    setNotes('');
    setAttachments([]);
  };

  const currentDisplayList = useMemo(() => {
    let list: ScheduledEvent[] = [];
    if (schedulerFilter === 'today') list = [...todaysFollowups];
    else if (schedulerFilter === 'pending') list = [...pendingFollowups];
    else if (schedulerFilter === 'upcoming') list = [...upcomingFollowups];
    else list = [...completedFollowups];

    return list.sort((a, b) => {
      if (sortBy === 'date') {
        const c = a.targetDate.localeCompare(b.targetDate);
        if (c !== 0) {
          return sortOrder === 'asc' ? c : -c;
        }
        return a.patient.name.localeCompare(b.patient.name);
      } else {
        const nameCompare = a.patient.name.localeCompare(b.patient.name);
        if (nameCompare !== 0) {
          return sortOrder === 'asc' ? nameCompare : -nameCompare;
        }
        return a.targetDate.localeCompare(b.targetDate);
      }
    });
  }, [schedulerFilter, todaysFollowups, pendingFollowups, upcomingFollowups, completedFollowups, sortBy, sortOrder]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Beautiful Sub-Tab-Bar to toggle between Log form and Scheduler view */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl mb-4 max-w-sm mx-auto select-none border dark:border-slate-805 border-slate-200/60 shadow-xs">
        {userRole !== 'user' && (
          <button
            type="button"
            onClick={() => setActiveFormTab('form')}
            className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              activeFormTab === 'form'
                ? `${activeTheme.primaryBg} text-white shadow-xs font-extrabold`
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Log Follow-Up Form
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveFormTab('scheduler')}
          className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
            activeFormTab === 'scheduler'
              ? `${activeTheme.primaryBg} text-white shadow-xs font-extrabold`
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Due Scheduler
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeFormTab === 'scheduler' && (
          <motion.div
            key="scheduler"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* SECTION 1: Dynamic Cohort Follow-Up Scheduler Card */}
            <div 
              id="cohort_scheduler_card" 
              className={`rounded-3xl border shadow-xs overflow-hidden transition-all duration-300 hover:scale-[1.008] ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.18)]' 
                  : 'bg-white border-slate-100 hover:border-indigo-500/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.12)]'
              }`}
            >
        <div className={`px-6 py-4.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <HeartPulse className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
            <div>
              <h2 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                Cohort Follow-Up Scheduler Monitor
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                Target dates: Year 1 protocol (Day 1 &bull; Monthly to 6 Months)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-slate-950/5 dark:bg-slate-950/40 p-1 rounded-xl max-w-sm ml-auto">
            <div className={`text-[9px] font-mono leading-relaxed px-2 py-0.5 rounded-md font-bold uppercase border ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-350' : 'bg-white border-slate-100 text-slate-500'
            }`}>
              Today: {bdDateTime.dateStr} | BD Time: {bdDateTime.timeStr}
            </div>
          </div>
        </div>

        {/* Tab Selection Filter Controls */}
        <div className={`px-6 pt-3 flex flex-wrap gap-2.5 border-b ${
          isDark ? 'border-slate-800/60 bg-slate-950/20' : 'border-slate-50 bg-[#FAFCFE]'
        }`}>
          <button
            type="button"
            onClick={() => setSchedulerFilter('today')}
            className={`pb-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 px-1 transition-all flex items-center gap-1.5 cursor-pointer ${
              schedulerFilter === 'today'
                ? (isDark ? 'border-white text-white' : 'border-slate-800 text-slate-900')
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Today's Due</span>
            <span className={`px-1.5 py-0.25 text-[9px] rounded-full font-mono ${
              todaysFollowups.length > 0
                ? 'bg-blue-600 text-white font-black'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              {todaysFollowups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSchedulerFilter('pending')}
            className={`pb-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 px-1 transition-all flex items-center gap-1.5 cursor-pointer ${
              schedulerFilter === 'pending'
                ? (isDark ? 'border-white text-white' : 'border-slate-800 text-slate-900')
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
            <span>Overdue Pending</span>
            <span className={`px-1.5 py-0.25 text-[9px] rounded-full font-mono ${
              pendingFollowups.length > 0
                ? 'bg-rose-550 text-white font-black'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              {pendingFollowups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSchedulerFilter('upcoming')}
            className={`pb-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 px-1 transition-all flex items-center gap-1.5 cursor-pointer ${
              schedulerFilter === 'upcoming'
                ? (isDark ? 'border-white text-white' : 'border-slate-800 text-slate-900')
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Upcoming Queue</span>
            <span className="px-1.5 py-0.25 text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full font-mono">
              {upcomingFollowups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSchedulerFilter('completed')}
            className={`pb-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 px-1 transition-all flex items-center gap-1.5 cursor-pointer ${
              schedulerFilter === 'completed'
                ? (isDark ? 'border-white text-white' : 'border-slate-800 text-slate-900')
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <History className="h-3.5 w-3.5 text-emerald-500" />
            <span>Completed Logs</span>
            <span className="px-1.5 py-0.25 text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full font-mono">
              {completedFollowups.length}
            </span>
          </button>
        </div>

        {/* Real-time calculated checklist table list */}
        <div className="p-5">
          {currentDisplayList.length > 0 && (
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 gap-2 border-b ${
              isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-101 bg-white/40'
            }`}>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className={`text-[11px] font-black uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-650'}`}>
                  Sort Timeline Chronology
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSortBy(prev => prev === 'date' ? 'name' : 'date')}
                  className={`px-3 py-1.5 rounded-xl border text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
                    sortBy === 'date'
                      ? 'bg-blue-600/10 text-blue-500 border-blue-500/25 shadow-xs'
                      : (isDark ? 'bg-slate-800 border-slate-700/80 text-slate-300 hover:bg-slate-750' : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100')
                  }`}
                  title="Toggle sorting between Target Follow-Up Date or Patient Name"
                >
                  By: {sortBy === 'date' ? '📅 Target Date' : '👤 Patient Name'}
                </button>

                <button
                  type="button"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className={`px-3 py-1.5 rounded-xl border text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700/85 text-slate-350 hover:bg-slate-750' : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Toggle Sorting Order"
                >
                  Order: {sortOrder === 'asc' ? '⬆ Ascending' : '⬇ Descending'}
                </button>
              </div>
            </div>
          )}

          {currentDisplayList.length === 0 ? (
            <div className="text-center py-10 px-4">
              <CheckCircle2 className="h-9 w-9 text-emerald-500/80 mx-auto mb-2.5" />
              <h4 className={`text-xs font-bold uppercase tracking-normal ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {schedulerFilter === 'today' && "True today tasks are clear"}
                {schedulerFilter === 'pending' && "No overdue clinical records detected"}
                {schedulerFilter === 'upcoming' && "No future scheduled treatment followups"}
                {schedulerFilter === 'completed' && "Completed timeline timeline is clear"}
              </h4>
              <p className="text-[10.5px] text-slate-400 dark:text-slate-550 max-w-sm mx-auto mt-1 leading-normal">
                {schedulerFilter === 'today' && "All patient milestones scheduled for today have compiled or been signed off successfully."}
                {schedulerFilter === 'pending' && "Excellent! The cohort status is synchronized. Zero pending/overdue checklists exist."}
                {schedulerFilter === 'upcoming' && "New patients admitted to primary treatments will populate chronological future milestones automatically."}
                {schedulerFilter === 'completed' && "A timeline tracker will trace historical signed events when assessments are registered."}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {currentDisplayList.map((evt, idx) => {
                const pat = evt.patient;
                
                // Color configuration according to target timeline status
                let pillBg = 'bg-slate-100 text-slate-600 border-slate-200';
                if (evt.isCompleted) {
                  pillBg = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                } else if (evt.statusText === 'today') {
                  pillBg = 'bg-blue-600/10 text-blue-550 border-blue-600/20 dark:text-blue-400';
                } else if (evt.statusText === 'overdue') {
                  pillBg = 'bg-rose-500/10 text-rose-550 border-rose-500/20 dark:text-rose-400 font-extrabold';
                }

                return (
                  <div 
                    key={`${pat.id}-s${evt.sessionNo}-${idx}`}
                    className={`border rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all hover:scale-[1.006] ${
                      isDark 
                        ? 'bg-slate-950/40 border-slate-800' 
                        : 'bg-[#FAFCFE]/70 border-slate-150/70 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Name initials Avatar */}
                      <div className={`h-8.5 w-8.5 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 ${activeTheme.primaryBg}`}>
                        {pat.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-150' : 'text-slate-850'}`}>
                            {pat.name}
                          </p>
                          <span className="font-mono text-[9px] text-slate-400 uppercase font-semibold">
                            {pat.code}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{evt.label}</span>
                          <span className="text-slate-300 dark:text-slate-800">&bull;</span>
                          <span>Last Session Date:</span>
                          <strong className="font-mono text-slate-600 dark:text-slate-350">{pat.date || 'Unspecified'}</strong>
                          {pat.treatmentSessions && pat.treatmentSessions.length > 0 && (
                            <span className="px-1.5 py-0.25 bg-emerald-500/10 text-emerald-500 text-[8.5px] font-bold uppercase rounded border border-emerald-500/20">
                              Session #{pat.sessionNo}
                            </span>
                          )}
                        </p>
                        
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${pillBg}`}>
                            {evt.isCompleted ? '✓ Completed' : evt.daysDiffText}
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-mono">
                            Target: {evt.targetDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!evt.isCompleted ? (
                      <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                        {userRole !== 'user' ? (
                          <button
                            type="button"
                            onClick={() => handleSelectScheduledEvent(evt)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white transition-all cursor-pointer shadow-xs focus:outline-none ${activeTheme.primaryBg}`}
                          >
                            <span>Assess Now</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className={`text-[10px] font-bold pr-2 ${isDark ? 'text-slate-500' : 'text-slate-400'} flex items-center gap-1.5 py-1 px-2 border rounded-lg ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50'}`}>
                            <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" /> Pending
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className={`text-[10px] font-bold pr-2 ${isDark ? 'text-slate-500' : 'text-slate-400'} flex items-center gap-1`}>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Done
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chronology Notice Banner */}
        <div className={`px-6 py-3 border-t text-[10.5px] leading-relaxed flex items-center gap-2.5 ${
          isDark ? 'border-slate-800 bg-slate-950/40 text-slate-350' : 'border-slate-100 bg-blue-50/15 text-slate-650'
        }`}>
          <Info className="h-4.5 w-4.5 text-blue-500 shrink-0" />
          <span>
            <strong>Chronological Auto-scheduling Protocol</strong>: Follow-up target dates are automatically calculated from the date of the <strong>last treatment session logged</strong> for each patient. Registering new treatment sessions shifts upcoming target dates to synchronize with their latest chronology.
          </span>
        </div>
      </div>
          </motion.div>
        )}

        {activeFormTab === 'form' && userRole !== 'user' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full"
          >
            {/* SECTION 2: Dynamic Form ("Add Clinical Follow-Up" Assessment form) */}
            <div 
              id="followup_form_container" 
        className={`rounded-3xl border shadow-xs overflow-hidden transition-colors duration-205 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}
      >
        <div className={`px-6 py-4.5 border-b flex items-center justify-between transition-colors duration-200 ${
          isDark ? 'border-slate-800 text-slate-100' : 'border-slate-100 text-slate-900'
        }`}>
          <div className="flex items-center gap-2">
            <Calendar className={`h-4.5 w-4.5 ${activeTheme.primaryText}`} />
            <h2 className="text-sm font-bold tracking-tight uppercase">Add Clinical Follow-Up</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label 
              htmlFor="followup_patient" 
              className={`block text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Patient <span className="text-rose-500">*</span>
            </label>
            {preselectedPatientId ? (
              <div 
                id="locked_patient_header" 
                className={`flex items-center gap-3 border rounded-xl p-3 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/60'
                }`}
              >
                <div className={`text-white h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${activeTheme.primaryBg}`}>
                  {selectedPatient?.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {selectedPatient?.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {selectedPatient?.code} &middot; Age {selectedPatient?.age} &middot; {selectedPatient?.diagnosis}
                  </p>
                </div>
              </div>
            ) : (
              <select
                id="followup_patient"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                  isDark 
                    ? 'bg-slate-950 border-slate-805 text-slate-100 focus:border-slate-700' 
                    : 'bg-white border-slate-200/80 text-slate-800 focus:border-slate-350 bg-white'
                }`}
              >
                <option value="">-- Select Active Clinical Record --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id} className={isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}>
                    {p.name} ({p.code}) {p.requiresFollowUp === false ? '[FOLLOW-UPS OFF]' : ''} - {p.diagnosis}
                  </option>
                ))}
              </select>
            )}

            {selectedPatient && (
              <div className="mt-2.5 flex items-center gap-2 p-2.5 rounded-xl border bg-slate-500/5 border-slate-200/40 dark:border-slate-800/60 select-none">
                <input
                  id="toggle_patient_followup_status"
                  type="checkbox"
                  checked={selectedPatient.requiresFollowUp !== false}
                  onChange={(e) => {
                    const updatedPatient = {
                      ...selectedPatient,
                      requiresFollowUp: e.target.checked
                    };
                    onUpdatePatient(updatedPatient);
                  }}
                  className={`h-4.5 w-4.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer ${
                    isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-300 bg-white'
                  }`}
                />
                <div className="flex-1">
                  <label htmlFor="toggle_patient_followup_status" className={`block text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                    isDark ? 'text-slate-300 hover:text-white' : 'text-slate-650 hover:text-slate-900'
                  }`}>
                    Requires Active Follow-Up Schedules
                  </label>
                  <p className="text-[9px] text-slate-400">
                    Toggle to suspend or resume this patient's 6-Month timeline tracker.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label 
                htmlFor="followup_date" 
                className={`block text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <input
                  id="followup_date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`block w-full pl-9 pr-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none transition-all font-sans ${
                    isDark 
                      ? 'bg-slate-950 border-slate-805 text-slate-100 focus:border-slate-700' 
                      : 'bg-white border-slate-200 text-slate-800 focus:border-slate-350'
                  }`}
                />
              </div>
            </div>

            <div>
              <label 
                htmlFor="followup_clinician" 
                className={`block text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Medical Officer <span className="text-rose-500">*</span>
              </label>
              <select
                id="followup_clinician"
                value={clinician}
                onChange={(e) => setClinician(e.target.value)}
                className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                  isDark 
                    ? 'bg-slate-950 border-slate-805 text-slate-100 focus:border-slate-700' 
                    : 'bg-white border-slate-200/80 text-slate-800 focus:border-slate-350 bg-white'
                }`}
                required
              >
                <option value="">-- Choose Registered consultant --</option>
                {settings.consultants.map((c) => (
                  <option key={c} value={c} className={isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}>{c}</option>
                ))}
                <option value="Other" className={isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}>Other (Specify)...</option>
              </select>
              {(clinician === 'Other' || !settings.consultants.includes(clinician)) && (
                <input
                  id="followup_custom_clinician"
                  type="text"
                  required
                  placeholder="e.g. Dr. Thomas Willis, MD"
                  value={customClinician}
                  onChange={(e) => setCustomClinician(e.target.value)}
                  className={`mt-2 block w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                    isDark 
                      ? 'bg-slate-955 border-slate-800 text-slate-100 focus:border-slate-700 placeholder-slate-600' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-slate-350 placeholder-slate-350'
                  }`}
                />
              )}
            </div>

            <div>
              <label 
                htmlFor="followup_session" 
                className={`block text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Follow-Up No. <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Hash className="h-3.5 w-3.5" />
                </span>
                <input
                  id="followup_session"
                  type="number"
                  required
                  min="1"
                  placeholder="2"
                  value={sessionNo}
                  onChange={(e) => setSessionNo(Number(e.target.value))}
                  className={`block w-full pl-9 pr-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none transition-all font-sans ${
                    isDark 
                      ? 'bg-slate-955 border-slate-800 text-slate-100 focus:border-slate-700' 
                      : 'bg-white border-slate-200 text-slate-800 focus:border-slate-350'
                  }`}
                />
              </div>
            </div>
          </div>

          <div>
            <label 
              htmlFor="followup_status" 
              className={`block text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Recovery Status <span className="text-rose-500">*</span>
            </label>
            <select
              id="followup_status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`block w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                isDark 
                  ? 'bg-slate-950 border-slate-805 text-slate-100 focus:border-slate-700' 
                  : 'bg-white border-slate-200/80 text-slate-800 focus:border-slate-350 bg-white'
              }`}
            >
              {(settings.recoveryStatuses || RECOVERY_STATUSES).map((stat) => (
                <option key={stat} value={stat} className={isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}>
                  {stat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label 
              htmlFor="followup_notes" 
              className={`block text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Clinical Observations & physical assessment <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="followup_notes"
              required
              rows={4}
              placeholder="Document patient reports, physical assessment details, modifications in drug administration, or planned future tests..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`block w-full px-4 py-3 border rounded-2xl text-xs font-medium focus:outline-none transition-all leading-relaxed resize-none h-28 ${
                isDark 
                  ? 'bg-slate-955 border-slate-800 text-slate-100 focus:border-slate-700 placeholder-slate-600' 
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-slate-350 placeholder-slate-350'
              }`}
            ></textarea>
          </div>

          {/* File Attachments Option */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label 
                className={`block text-[11px] font-bold uppercase tracking-widest ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                File Attachments (Optional)
              </label>
              <label className={`text-[10px] font-bold uppercase tracking-wider hover:underline cursor-pointer flex items-center gap-1 transition-colors ${activeTheme.primaryText}`}>
                <Upload className="h-3.5 w-3.5" /> Attach File
                <input
                  type="file"
                  className="hidden"
                  onChange={handleAttachmentUpload}
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <div className={`text-[10px] italic rounded-xl p-3 border border-dashed text-center ${
                isDark ? 'bg-slate-950 border-slate-800/80 text-slate-500' : 'bg-slate-50/50 border-slate-200/60 text-slate-400'
              }`}>
                No file attachments selected for this follow-up. Click "Attach File" to upload diagnostic or laboratory results.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {attachments.map((file) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                    <div key={file.id} className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${
                      isDark ? 'bg-slate-950 hover:bg-slate-900 border-slate-800/80' : 'bg-slate-50 hover:bg-slate-150 border-slate-155'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isImage ? (
                          <div className={`w-8 h-8 rounded border overflow-hidden flex items-center justify-center shrink-0 ${
                            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                          }`}>
                            <img src={file.data} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-extrabold text-[9px] uppercase border ${
                            isDark ? 'bg-slate-905 border-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {file.name.split('.').pop()?.substring(0, 3) || 'doc'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-705'}`} title={file.name}>{file.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(file.id)}
                        className={`p-1 rounded-md transition-all cursor-pointer ml-2 ${
                          isDark ? 'text-slate-500 hover:text-red-400 hover:bg-slate-850' : 'text-slate-400 hover:text-red-650 hover:bg-white'
                        }`}
                        title="Remove file attachment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`pt-4 border-t flex items-center justify-end gap-3 font-sans ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}>
            {onCancel && (
              <button
                id="cancel_followup_btn"
                type="button"
                onClick={onCancel}
                className={`px-4 py-2 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300' 
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500'
                }`}
              >
                Cancel
              </button>
            )}
            <button
              id="submit_followup_btn"
              type="submit"
              className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-white focus:outline-none transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer ${activeTheme.primaryBg}`}
            >
              <Plus className="h-4 w-4" /> Log Follow-Up
            </button>
          </div>
        </form>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Clock, ArrowRight, X, CalendarCheck } from 'lucide-react';
import { Patient } from '../types/patient';
import { ThemeOption } from '../types/settings';

interface DailyDigestNotificationProps {
  patients: Patient[];
  activeTheme: ThemeOption;
  onNavigateToFollowUp: (patientId: string) => void;
  isMenuIcon?: boolean;
  isActive?: boolean;
}

// Safer local date calculators to ignore timezone discrepancies
function addDaysLocal(dateStr: string, days: number): string {
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

function getTodayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DailyDigestNotification({
  patients,
  activeTheme,
  onNavigateToFollowUp,
  isMenuIcon = false,
  isActive = false
}: DailyDigestNotificationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isDark = activeTheme.isDark;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const todayStr = useMemo(() => getTodayStr(), []);

  // Compute all active/pending follow-up events
  const digestItems = useMemo(() => {
    const overdueList: Array<{ patient: Patient; label: string; date: string; sessionNo: number; type: 'overdue' }> = [];
    const todayList: Array<{ patient: Patient; label: string; date: string; sessionNo: number; type: 'today' }> = [];

    patients.forEach((p) => {
      if (p.requiresFollowUp === false) return;

      const baseDate = p.date || p.createdAt?.split('T')[0] || todayStr;
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
        const targetDate = addDaysLocal(baseDate, sch.offset);
        
        // A scheduled session is completed if there's a logged follow-up with matching sessionNo and treatmentSessionNo
        const isCompleted = p.followUps && p.followUps.some((f) => {
          const belongsToCurrentSession = f.treatmentSessionNo
            ? f.treatmentSessionNo === p.sessionNo
            : p.sessionNo <= 1;
          return belongsToCurrentSession && f.sessionNo === sch.session;
        });

        if (!isCompleted) {
          if (targetDate === todayStr) {
            todayList.push({
              patient: p,
              label: sch.label,
              date: targetDate,
              sessionNo: sch.session,
              type: 'today'
            });
          } else if (targetDate < todayStr) {
            overdueList.push({
              patient: p,
              label: sch.label,
              date: targetDate,
              sessionNo: sch.session,
              type: 'overdue'
            });
          }
        }
      });
    });

    return { overdueList, todayList, totalCount: overdueList.length + todayList.length };
  }, [patients, todayStr]);

  const { overdueList, todayList, totalCount } = digestItems;

  return (
    <div className={isMenuIcon ? "relative flex-1 flex" : "relative inline-block text-left"} ref={dropdownRef}>
      {/* Trigger Button */}
      {isMenuIcon ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`relative flex items-center justify-center flex-1 py-3 transition-opacity duration-150 cursor-pointer focus:outline-none w-full ${
            isOpen || isActive
              ? 'text-blue-600'
              : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Follow-Up Daily Digest"
        >
          <Bell className="h-6 w-6" fill={(isOpen || isActive) ? "currentColor" : "none"} />
          {totalCount > 0 && (
            <span className="absolute top-2 right-1/2 translate-x-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#f02849] text-[10px] font-bold text-white shadow-sm leading-none">
              {totalCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-slate-950 border-slate-850 text-slate-300 hover:text-white hover:bg-slate-900'
              : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Follow-Up Daily Digest"
        >
          <Bell className="h-4.5 w-4.5" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black tracking-tighter text-white animate-pulse">
              {totalCount}
            </span>
          )}
        </button>
      )}

      {/* Popover Card */}
      {isOpen && (
        <div className={`absolute ${isMenuIcon ? 'right-[-120px] sm:right-[-60px] md:right-0 mt-14' : 'right-0 mt-3'} w-80 sm:w-96 rounded-2xl border shadow-xl z-50 overflow-hidden font-sans ${
          isDark 
            ? 'bg-slate-950/95 backdrop-blur-md border-slate-800 text-slate-100 shadow-slate-950/80' 
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between ${
            isDark ? 'border-slate-900 bg-slate-900/40' : 'border-slate-100 bg-slate-50/50'
          }`}>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <CalendarCheck className={`h-4 w-4 ${activeTheme.primaryText}`} /> Daily Follow-Up Digest
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Overview of patient clinical checkpoints
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-900' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100/30 dark:divide-slate-900">
            {totalCount === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2.5">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-slate-900/60' : 'bg-slate-50'
                }`}>
                  <CalendarCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider">All Clear!</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-[220px] mx-auto">
                    Zero overdue or due-today follow-up schedules. Outstanding cohort is synchronized.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Due Today Queue */}
                {todayList.length > 0 && (
                  <div className="p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1 mb-2">
                      <Clock className="h-3 w-3" /> Due Today ({todayList.length})
                    </p>
                    <div className="space-y-1.5">
                      {todayList.map((item, idx) => (
                        <div
                          key={`${item.patient.id}-today-${idx}`}
                          onClick={() => {
                            onNavigateToFollowUp(item.patient.id);
                            setIsOpen(false);
                          }}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 group scale-100 hover:scale-[1.01] active:scale-[0.99] ${
                            isDark 
                              ? 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80' 
                              : 'bg-emerald-50/20 hover:bg-emerald-50/45 border-emerald-100/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[11px] font-extrabold truncate text-slate-700 dark:text-slate-200">
                                {item.patient.name}
                              </p>
                              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded uppercase shrink-0">
                                {item.patient.code}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                              {item.label} (Session {item.sessionNo})
                            </p>
                          </div>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overdue Queue */}
                {overdueList.length > 0 && (
                  <div className="p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-1 mb-2">
                      <AlertTriangle className="h-3 w-3" /> Overdue Schedule ({overdueList.length})
                    </p>
                    <div className="space-y-1.5">
                      {overdueList.map((item, idx) => (
                        <div
                          key={`${item.patient.id}-overdue-${idx}`}
                          onClick={() => {
                            onNavigateToFollowUp(item.patient.id);
                            setIsOpen(false);
                          }}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 group scale-100 hover:scale-[1.01] active:scale-[0.99] ${
                            isDark 
                              ? 'bg-rose-950/10 hover:bg-rose-950/20 border-rose-950/20' 
                              : 'bg-rose-50/20 hover:bg-rose-50/45 border-rose-100/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[11px] font-extrabold truncate text-slate-700 dark:text-slate-100">
                                {item.patient.name}
                              </p>
                              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-rose-100/50 dark:bg-rose-950/40 text-rose-600 rounded uppercase shrink-0">
                                {item.patient.code}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                              {item.label} &bull; <span className="text-rose-500 font-bold">{item.date}</span>
                            </p>
                          </div>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer view detailed tracker link */}
          {totalCount > 0 && (
            <div className={`p-2.5 text-center border-t text-[10px] uppercase tracking-wider font-extrabold cursor-pointer transition-colors ${
              isDark 
                ? 'bg-slate-900/60 hover:bg-slate-900 border-slate-900 text-slate-300 hover:text-white' 
                : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => {
              onNavigateToFollowUp('');
              setIsOpen(false);
            }}
            >
              Access Complete Scheduler Pipeline
            </div>
          )}
        </div>
      )}
    </div>
  );
}

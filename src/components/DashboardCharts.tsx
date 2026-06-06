import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Shield, 
  TrendingUp, 
  HeartPulse, 
  Activity, 
  Stethoscope,
  Compass, 
  Sparkles, 
  Clock, 
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp as TrendIcon,
  Activity as ActivityIcon
} from 'lucide-react';
import { Patient } from '../types/patient';
import { ThemeOption } from '../types/settings';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';

interface DashboardChartsProps {
  patients: Patient[];
  isDark?: boolean;
  activeTheme?: ThemeOption;
}

// Visual premium color palette for pathology categories
const PATHOLOGY_PALETTE = [
  '#4f46e5', // INDIGO
  '#0d9488', // TEAL
  '#06b6d4', // CYAN
  '#8b5cf6', // PURPLE
  '#ec4899', // PINK
  '#f59e0b', // AMBER
  '#10b981', // EMERALD
  '#f43f5e', // ROSE
];

// Improvements color mapper corresponding to clinical outcomes
const IMPROVEMENT_COLORS: Record<string, string> = {
  'Significantly Improved': '#10b981', // Emerald
  'Improved': '#3b82f6', // Blue
  'Stable': '#6366f1', // Indigo
  'Unchanged': '#e2e8f0', // Cool Gray / Secondary offset
  'Deteriorated': '#f43f5e', // Rose
};

// Tooltip component custom styled to match theme perfectly
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  isDark?: boolean;
}

const CustomTooltip = ({ active, payload, label, isDark }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className={`p-4 rounded-2xl border text-xs font-sans shadow-lg transition-transform duration-150 ${
        isDark 
          ? 'bg-slate-950 border-slate-800 text-slate-100 shadow-black/40' 
          : 'bg-white border-slate-100 text-slate-800 shadow-slate-100/50'
      }`}>
        <p className="font-bold tracking-tight text-[10.5px] uppercase text-slate-400 dark:text-slate-500 mb-1.5">
          {label || item.name}
        </p>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || item.payload.fill || '#3b82f6' }}></div>
          <p className="font-semibold text-xs leading-none">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Count: </span>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{item.value} Case{item.value !== 1 ? 's' : ''}</span>
          </p>
        </div>
        {item.payload.percent !== undefined && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold font-mono">
            Distribution: {Math.round(item.payload.percent * 10) / 10}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function DashboardCharts({ patients, isDark = false, activeTheme }: DashboardChartsProps) {
  const [activeChartGroup, setActiveChartGroup] = useState<'overview' | 'clinical' | 'consultancy'>('overview');
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>('');

  const totalRecords = patients.length;

  // Compute stats safely
  const diagnosisData = useMemo(() => {
    const counts: Record<string, number> = {};
    patients.forEach((p) => {
      const d = p.diagnosis || 'Unspecified Pathology';
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [patients]);

  const treatmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    patients.forEach((p) => {
      const t = p.treatment || 'Unassigned Treatment';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [patients]);

  const routeData = useMemo(() => {
    const counts: Record<string, number> = {};
    patients.forEach((p) => {
      const r = p.route || 'Oral / Other';
      counts[r] = (counts[r] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .map(([name, value]) => ({ 
        name, 
        value,
        percent: (value / total) * 100
      }))
      .sort((a, b) => b.value - a.value);
  }, [patients]);

  const improvementData = useMemo(() => {
    const counts: Record<string, number> = {
      'Significantly Improved': 0,
      'Improved': 0,
      'Stable': 0,
      'Unchanged': 0,
      'Deteriorated': 0,
    };
    patients.forEach((p) => {
      const imp = p.improvement || 'Stable';
      if (imp in counts) {
        counts[imp]++;
      } else {
        counts['Stable']++;
      }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([name, value]) => ({ 
      name, 
      value,
      percent: (value / total) * 100
    }));
  }, [patients]);

  const consultantData = useMemo(() => {
    const counts: Record<string, number> = {};
    patients.forEach((p) => {
      const c = p.consultant || 'Staff Clinician';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [patients]);

  // Caseload addition velocity over time
  const timelineData = useMemo(() => {
    const counts: Record<string, number> = {};
    patients.forEach((p) => {
      if (!p.date) return;
      const m = p.date.substring(0, 7); // YYYY-MM
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [patients]);

  const monthlyDiagnosisData = useMemo(() => {
    const groups: Record<string, Record<string, number>> = {};
    patients.forEach((p) => {
      if (!p.date) return;
      const month = p.date.substring(0, 7); // YYYY-MM
      if (!groups[month]) {
        groups[month] = {};
      }
      const d = p.diagnosis || 'Unspecified';
      groups[month][d] = (groups[month][d] || 0) + 1;
    });

    return Object.entries(groups)
      .map(([month, diags]) => {
        const diagnosesList = Object.entries(diags)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        const totalInMonth = diagnosesList.reduce((sum, item) => sum + item.count, 0);
        return {
          month,
          diagnoses: diagnosesList,
          total: totalInMonth
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month)); // newest months first
  }, [patients]);

  const monthsList = useMemo(() => {
    return monthlyDiagnosisData.map(d => d.month);
  }, [monthlyDiagnosisData]);

  const activeMonth = selectedMonthStr || monthsList[0] || '';
  const currentMonthData = useMemo(() => {
    return monthlyDiagnosisData.find(d => d.month === activeMonth) || monthlyDiagnosisData[0];
  }, [monthlyDiagnosisData, activeMonth]);

  const formatMonthLabel = (mStr: string) => {
    if (!mStr) return '';
    const parts = mStr.split('-');
    if (parts.length < 2) return mStr;
    const [year, month] = parts;
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${months[mIdx] || month} ${year}`;
  };

  // Safe Empty Cohort State fallback
  if (totalRecords === 0) {
    return (
      <div 
        id="no_charts_fallback" 
        className={`rounded-3xl border p-12 text-center max-w-lg mx-auto shadow-xs transition-colors duration-200 ${
          isDark 
            ? 'bg-slate-900 border-slate-800 text-slate-100' 
            : 'bg-white border-slate-100 text-slate-900'
        }`}
      >
        <div className="text-slate-400 mb-4 flex justify-center">
          <BarChart3 className="h-10 w-10 text-slate-300 dark:text-slate-700" />
        </div>
        <h4 className="text-sm font-bold uppercase tracking-tight">Analytical Canvas is Empty</h4>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1.5 leading-normal">
          Anonymized clinical summary statistics will compile automatically as new individual records are registered.
        </p>
      </div>
    );
  }

  const fillBgColorForTheme = activeTheme?.primaryBg || 'bg-indigo-600';
  const strokeColorForTheme = isDark ? '#312e81' : '#e0e7ff';

  return (
    <div id="dashboard_analytics_panel" className="space-y-6 font-sans">
      {/* Top beautiful statistical grids */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Active Cohort - Classic Indigo */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 rounded-3xl p-5 shadow-lg shadow-indigo-600/10 text-white relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10">
            <BarChart3 className="h-28 w-28 text-white" />
          </div>
          <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest leading-none">Active Cohort</p>
          <p className="text-3xl font-black mt-2 font-display">{totalRecords}</p>
          <p className="text-[10px] font-mono mt-2 flex items-center gap-1 font-bold text-indigo-100 bg-white/10 px-2 py-1 rounded-full w-max">
            <Shield className="h-3 w-3 text-emerald-300 shrink-0" /> Stable Dossiers
          </p>
        </div>

        {/* Card 2: Primary Diagnoses - Clinical Teal/Emerald */}
        <div className="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 rounded-3xl p-5 shadow-lg shadow-teal-500/10 text-white relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10">
            <HeartPulse className="h-28 w-28 text-white" />
          </div>
          <p className="text-[10px] font-bold text-teal-100 uppercase tracking-widest leading-none">Pathology Profiles</p>
          <p className="text-3xl font-black mt-2 font-display">{diagnosisData.length}</p>
          <p className="text-[10px] font-mono mt-2 flex items-center gap-1 font-bold text-teal-50 bg-white/10 px-2 py-1 rounded-full w-max">
            <Layers className="h-3 w-3 text-cyan-200 shrink-0" /> Target Categories
          </p>
        </div>

        {/* Card 3: Clinical Progress - Pink/Rose */}
        <div className="bg-gradient-to-br from-rose-500 via-pink-600 to-purple-600 rounded-3xl p-5 shadow-lg shadow-rose-500/10 text-white relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10">
            <TrendingUp className="h-28 w-28 text-white" />
          </div>
          <p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest leading-none">Positive Recovery</p>
          <p className="text-3xl font-black mt-2 font-display">
            {Math.round(
              ((improvementData.find((d) => d.name === 'Significantly Improved')?.value || 0) +
                (improvementData.find((d) => d.name === 'Improved')?.value || 0)) /
                totalRecords * 100
            )}%
          </p>
          <p className="text-[10px] font-mono mt-2 flex items-center gap-1 font-bold text-rose-50 bg-white/10 px-2 py-1 rounded-full w-max">
            <ArrowUpRight className="h-3 w-3 text-emerald-300 shrink-0" /> Significant / Improved
          </p>
        </div>

        {/* Card 4: Total Consultations - Warm Amber/Orange */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 rounded-3xl p-5 shadow-lg shadow-amber-500/10 text-white relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10">
            <Activity className="h-28 w-28 text-white" />
          </div>
          <p className="text-[10px] font-bold text-amber-100 uppercase tracking-widest leading-none">Consultation Load</p>
          <p className="text-3xl font-black mt-2 font-display">
            {totalRecords + patients.reduce((acc, p) => acc + (p.followUps?.length || 0), 0)}
          </p>
          <p className="text-[10px] font-mono mt-2 flex items-center gap-1 font-bold text-amber-50 bg-white/10 px-2 py-1 rounded-full w-max">
            <Clock className="h-3 w-3 text-yellow-300 shrink-0" /> Active Visits
          </p>
        </div>
      </div>

      {/* Modern segmented navigation group selectors */}
      <div className={`flex border-b gap-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <button
          id="btn_chart_overview"
          onClick={() => setActiveChartGroup('overview')}
          className={`pb-3 text-xs font-bold uppercase tracking-widest border-b-2 px-4 transition-all duration-150 cursor-pointer ${
            activeChartGroup === 'overview'
              ? (isDark ? 'border-slate-150 text-slate-100' : 'border-slate-800 text-slate-900')
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Diagnosis & Route
        </button>
        <button
          id="btn_chart_clinical"
          onClick={() => setActiveChartGroup('clinical')}
          className={`pb-3 text-xs font-bold uppercase tracking-widest border-b-2 px-4 transition-all duration-150 cursor-pointer ${
            activeChartGroup === 'clinical'
              ? (isDark ? 'border-slate-150 text-slate-100' : 'border-slate-800 text-slate-900')
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Outcome & Treatments
        </button>
        <button
          id="btn_chart_consultancy"
          onClick={() => setActiveChartGroup('consultancy')}
          className={`pb-3 text-xs font-bold uppercase tracking-widest border-b-2 px-4 transition-all duration-150 cursor-pointer ${
            activeChartGroup === 'consultancy'
              ? (isDark ? 'border-slate-150 text-slate-100' : 'border-slate-800 text-slate-900')
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Consultant Load
        </button>
      </div>

      {/* Render active group panels */}
      {activeChartGroup === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Diagnosis distribution (Lg spanning 3) */}
          <div className={`lg:col-span-3 border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-colors duration-200 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className={`flex items-start justify-between pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  <HeartPulse className="h-3.5 w-3.5 text-indigo-500 shrink-0 animate-pulse" />
                  Primary Diagnosis Pathologies
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Distribution volume represented across diagnoses</p>
              </div>
              <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-md uppercase ${isDark ? 'bg-indigo-950 text-indigo-300' : 'bg-indigo-55 text-indigo-700'}`}>
                {diagnosisData.length} Illnesses
              </span>
            </div>

            {/* Recharts BarChart */}
            <div className="w-full pt-4 min-h-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={diagnosisData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 15, bottom: 5 }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"} 
                    horizontal={true}
                    vertical={false} 
                  />
                  <XAxis 
                    type="number" 
                    stroke={isDark ? "#475569" : "#cbd5e1"} 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false} 
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke={isDark ? "#94a3b8" : "#475569"} 
                    fontSize={10.5} 
                    width={110} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(name) => name.length > 15 ? `${name.substring(0, 14)}…` : name}
                  />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)' }} />
                  <Bar dataKey="value" barSize={16} radius={[0, 4, 4, 0]}>
                    {diagnosisData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PATHOLOGY_PALETTE[index % PATHOLOGY_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Routes of Administration Donut Chart (Lg spanning 2) */}
          <div className={`lg:col-span-2 border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-colors duration-200 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className={`pb-4 border-b flex items-start justify-between ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  <Compass className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                  Routes of Administration
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Distribution profile of biological access paths</p>
              </div>
            </div>

            <div className="pt-2 flex flex-col justify-center items-center flex-1">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={routeData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {routeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PATHOLOGY_PALETTE[(index + 2) % PATHOLOGY_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Enhanced Interactive Custom Legend */}
              <div className="w-full grid grid-cols-2 gap-2 text-[10.5px] font-medium pt-2 mt-auto">
                {routeData.slice(0, 4).map((entry, idx) => (
                  <div key={entry.name} className="flex items-center gap-1.5 min-w-0" title={entry.name}>
                    <div 
                      className="h-2 w-2 rounded-full shrink-0" 
                      style={{ backgroundColor: PATHOLOGY_PALETTE[(idx + 2) % PATHOLOGY_PALETTE.length] }}
                    ></div>
                    <span className={`truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{entry.name}</span>
                    <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 font-bold ml-autoshrink-0">
                      ({Math.round(entry.percent)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeChartGroup === 'clinical' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Recovery Spectrum - Radar Chart (Lg 2) */}
          <div className={`lg:col-span-2 border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-colors duration-200 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className={`pb-4 border-b flex items-start justify-between ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  <TrendingUp className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                  Clinical Outcome Spectrum
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Amalgamated recovery and response outcomes</p>
              </div>
            </div>

            <div className="flex flex-col justify-center items-center flex-1 py-2">
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={improvementData}>
                  <PolarGrid stroke={isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"} />
                  <PolarAngleAxis 
                    dataKey="name" 
                    tick={{ fill: isDark ? '#94a3b8' : '#334155', fontSize: 8.5, fontWeight: 500 }} 
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 'auto']} 
                    tick={{ fill: isDark ? '#4f5e71' : '#94a3b8', fontSize: 8 }}
                  />
                  <Radar 
                    name="Patients" 
                    dataKey="value" 
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.35} 
                  />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                </RadarChart>
              </ResponsiveContainer>

              {/* Status breakdown with custom visual badges */}
              <div className="w-full space-y-1.5 mt-auto pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                {improvementData.map(({ name, value, percent }) => (
                  <div key={name} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: IMPROVEMENT_COLORS[name] || '#94a3b8' }}></div>
                      <span className={isDark ? 'text-slate-350' : 'text-slate-700'}>{name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className={`px-1.5 py-0.2 rounded-md font-bold text-[9px] ${
                        name.includes('Improved') 
                          ? (isDark ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
                          : name.includes('Stable') 
                            ? (isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')
                            : (isDark ? 'bg-rose-950/40 text-rose-300' : 'bg-rose-50 text-rose-700')
                      }`}>
                        {value} Case{value !== 1 ? 's' : ''}
                      </span>
                      <span className="text-slate-400 font-semibold text-[10px] w-9 text-right">{Math.round(percent)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Treatments distribution (Lg 3) */}
          <div className={`lg:col-span-3 border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-colors duration-200 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className={`flex items-start justify-between pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  Common Treatment Protocols Administered
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Comparison of active clinical treatment formulations in use</p>
              </div>
              <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-md uppercase ${isDark ? 'bg-blue-950 text-blue-300' : 'bg-blue-55 text-blue-700'}`}>
                {treatmentData.length} Modalities
              </span>
            </div>

            <div className="w-full pt-4 min-h-[260px]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={treatmentData.slice(0, 8)}
                  margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"} 
                    vertical={false} 
                  />
                  <XAxis 
                    dataKey="name" 
                    stroke={isDark ? "#475569" : "#cbd5e1"} 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.length > 12 ? `${v.substring(0, 9)}…` : v}
                  />
                  <YAxis 
                    stroke={isDark ? "#475569" : "#cbd5e1"} 
                    fontSize={10.5} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)' }} />
                  <Bar dataKey="value" barSize={18} radius={[4, 4, 0, 0]}>
                    {treatmentData.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PATHOLOGY_PALETTE[(index + 4) % PATHOLOGY_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeChartGroup === 'consultancy' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Consultant Load Distribution (Lg 2) */}
          <div className={`lg:col-span-2 border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-colors duration-200 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className={`pb-4 border-b flex items-start justify-between ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  <Stethoscope className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  Consultant Patient Allocation
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Assigned cohort load assigned to medical consultants</p>
              </div>
            </div>

            <div className="w-full pt-4 min-h-[250px]">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart 
                  data={consultantData} 
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"} 
                    horizontal={true}
                    vertical={false} 
                  />
                  <XAxis 
                    type="number" 
                    stroke={isDark ? "#475569" : "#cbd5e1"} 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke={isDark ? "#94a3b8" : "#475569"} 
                    fontSize={10.5} 
                    width={90} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => v.replace('Dr. ', '')}
                  />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Bar dataKey="value" barSize={15} radius={[0, 4, 4, 0]}>
                    {consultantData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PATHOLOGY_PALETTE[(index + 1) % PATHOLOGY_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cohort Registrations Over Time (Lg 3) */}
          <div className={`lg:col-span-3 border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-colors duration-200 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className={`flex items-start justify-between pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  <Calendar className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  Historical Patient Admissions Velocity
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Chronological timeline tracking admission registry capacity</p>
              </div>
            </div>

            <div className="w-full pt-4 min-h-[250px]">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <defs>
                    <linearGradient id="admissionCountGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"} 
                  />
                  <XAxis 
                    dataKey="date" 
                    stroke={isDark ? "#475569" : "#cbd5e1"} 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => formatMonthLabel(v)} 
                  />
                  <YAxis 
                    stroke={isDark ? "#475569" : "#cbd5e1"} 
                    fontSize={10.5} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#6366f1" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#admissionCountGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Filter Panel - Preserved & beautifully visualised underneath */}
      {activeChartGroup === 'overview' && monthsList.length > 0 && (
        <div className={`border rounded-3xl p-6 shadow-xs transition-colors duration-200 ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-dashed border-slate-100 dark:border-slate-800 mb-4 animate-fade-in">
            <div>
              <h4 className={`text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                Monthly Pathology Breakdown
              </h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Filter diagnoses timeline by individual cohort registry months</p>
            </div>

            {/* Horizontal pill list of available registry months */}
            <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-thin scrollbar-none scroll-smooth shrink-0 max-w-full md:max-w-md snap-x">
              {monthsList.map((m) => {
                const isSelected = m === activeMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMonthStr(m)}
                    className={`px-3 py-1.5 text-[10.5px] font-bold rounded-xl whitespace-nowrap snap-center transition-all cursor-pointer border ${
                      isSelected
                        ? (isDark
                            ? 'bg-slate-100 text-slate-950 border-transparent shadow-xs font-extrabold'
                            : 'bg-slate-900 text-white border-transparent shadow-xs font-extrabold')
                        : (isDark
                            ? 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                            : 'bg-slate-55 text-slate-500 border-slate-200/60 hover:text-slate-900')
                    }`}
                  >
                    {formatMonthLabel(m)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-2 flex items-center justify-between text-[11px] font-bold">
            <span className={isDark ? 'text-indigo-400' : 'text-indigo-600'}>
              DIAGNOSES LOGS FOR {formatMonthLabel(activeMonth).toUpperCase()}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] ${isDark ? 'bg-indigo-950/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
              Registered: {currentMonthData?.total || 0} Patient{(currentMonthData?.total !== 1) ? 's' : ''}
            </span>
          </div>

          {/* Current selected Month diagnosis proportions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-3.5">
            {currentMonthData?.diagnoses.map(({ name, count }) => {
              const percent = Math.round((count / currentMonthData.total) * 100);
              return (
                <div 
                  key={name} 
                  className={`p-4 border rounded-2xl flex flex-col justify-between transition-transform duration-100 hover:translate-y-[-1px] ${
                    isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-105 bg-slate-50/40'
                  }`}
                >
                  <span className={`text-[11.5px] font-semibold leading-tight truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title={name}>
                    {name}
                  </span>
                  <div className="flex items-baseline justify-between mt-4">
                    <span className="font-mono text-xl font-bold dark:text-indigo-400 text-indigo-600">
                      {count} <span className="text-[10px] text-slate-405 font-medium">Case{count > 1 ? 's' : ''}</span>
                    </span>
                    <span className="font-mono text-[10.5px] text-slate-404 font-bold">
                      {percent}%
                    </span>
                  </div>
                  {/* Subtle bar indicator */}
                  <div className={`mt-2 h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
            {(!currentMonthData || currentMonthData.diagnoses.length === 0) && (
              <p className="text-[11.5px] text-slate-400 dark:text-slate-500 text-center py-6 italic w-full">No clinical data recorded for this period.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

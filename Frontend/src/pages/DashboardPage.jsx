import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ArrowRight, Loader2, Github, FileArchive, ChevronRight,
  TrendingUp, TrendingDown, Shield, ShieldAlert, ShieldCheck,
  Activity, AlertTriangle, Minus,
} from 'lucide-react';
import { scanAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useScan } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────────────────────── */
const PIE_COLORS  = ['#f43f5e', '#f97316', '#f59e0b', '#6366f1', '#94a3b8'];
const SEV_META    = [
  { key: 'critical_count', label: 'Critical', color: '#f43f5e', bg: 'bg-rose-500/10',   text: 'text-rose-400'   },
  { key: 'high_count',     label: 'High',     color: '#f97316', bg: 'bg-orange-500/10',  text: 'text-orange-400' },
  { key: 'medium_count',   label: 'Medium',   color: '#f59e0b', bg: 'bg-amber-500/10',   text: 'text-amber-400'  },
  { key: 'low_count',      label: 'Low',      color: '#6366f1', bg: 'bg-indigo-500/10',  text: 'text-indigo-400' },
  { key: 'info_count',     label: 'Info',     color: '#94a3b8', bg: 'bg-slate-500/10',   text: 'text-slate-400'  },
];

const relativeTime = (ts) => {
  if (!ts) return '—';
  const ms   = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)      return `${diff}s ago`;
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400*7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const calcScore = (jobs) => {
  const done = jobs.filter(j => j.status === 'completed' || j.status === 'partial');
  if (!done.length) return null;
  const p = done.reduce((s, j) =>
    s + (j.critical_count||0)*20 + (j.high_count||0)*8
      + (j.medium_count||0)*3   + (j.low_count||0)*1, 0);
  return Math.max(0, 100 - Math.round(p / done.length));
};

/* ─────────────────────────────────────────────────────────────
   CUSTOM TOOLTIP
───────────────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-sm
      ${isDark ? 'bg-[#1e2235] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{p.name}</span>
          <span className="font-bold ml-auto pl-4 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   KPI CARD
───────────────────────────────────────────────────────────── */
const KpiCard = ({ label, value, sub, icon: Icon, accentColor, trend, isDark }) => {
  const isUp = trend > 0;
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-200
      ${isDark
        ? 'bg-[#161929] border-white/5 hover:border-white/10'
        : 'bg-white border-slate-100 shadow-sm hover:shadow-md'}`}>
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: accentColor + '20' }}
        >
          <Icon size={18} style={{ color: accentColor }} />
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg
            ${isUp
              ? accentColor === '#f43f5e' || accentColor === '#f97316'
                ? isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'
                : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
            {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>{isUp ? '+' : ''}{trend}</span>
          </div>
        )}
      </div>
      <div>
        <p className={`text-3xl font-black tabular-nums leading-none mb-1.5
          ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {value ?? '—'}
        </p>
        <p className={`text-[11px] font-bold uppercase tracking-widest
          ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
        {sub && (
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SCORE RING
───────────────────────────────────────────────────────────── */
const ScoreRing = ({ score, isDark }) => {
  const r     = 54;
  const circ  = 2 * Math.PI * r;
  const fill  = score !== null ? (score / 100) * circ : 0;
  const color = score === null ? '#94a3b8'
    : score >= 75 ? '#22c55e'
    : score >= 50 ? '#f59e0b'
    : '#f43f5e';

  return (
    <div className={`rounded-2xl border p-6 flex items-center gap-6
      ${isDark ? 'bg-[#161929] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="relative flex-shrink-0">
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={r} fill="none"
            stroke={isDark ? '#1e2235' : '#f1f5f9'} strokeWidth="10" />
          <circle cx="64" cy="64" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
            transform="rotate(-90 64 64)"
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }}
          />
          <text x="64" y="60" textAnchor="middle" fontSize="26" fontWeight="900"
            fill={isDark ? '#fff' : '#0f172a'}>{score ?? '—'}</text>
          <text x="64" y="76" textAnchor="middle" fontSize="10" fontWeight="600"
            fill={isDark ? '#64748b' : '#94a3b8'}>/ 100</text>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1
          ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Health Score</p>
        <p className={`text-xl font-black leading-tight mb-3
          ${isDark ? 'text-white' : 'text-slate-900'}`}
          style={{ color }}>
          {score === null ? 'No data yet' : score >= 75 ? 'Good standing' : score >= 50 ? 'Needs attention' : 'Critical risk'}
        </p>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Aggregate security posture across all completed scans. Based on weighted vulnerability penalty.
        </p>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SIDEBAR ROW
───────────────────────────────────────────────────────────── */
const SidebarRow = ({ job, onView, isDark }) => {
  const isViewable = job.status === 'completed' || job.status === 'partial';
  const SrcIcon    = job.source_type === 'github' ? Github : FileArchive;
  const crit       = job.critical_count || 0;
  const high       = job.high_count     || 0;
  const total      = job.total_vulnerabilities || 0;

  let badge = null;
  if (crit > 0)        badge = { label: `${crit}C`, color: '#f43f5e', bg: isDark ? 'bg-rose-500/10' : 'bg-rose-50' };
  else if (high > 0)   badge = { label: `${high}H`, color: '#f97316', bg: isDark ? 'bg-orange-500/10' : 'bg-orange-50' };
  else if (total > 0)  badge = { label: `${total}`,  color: '#6366f1', bg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50' };
  else if (isViewable) badge = { label: 'Clean',      color: '#22c55e', bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' };

  return (
    <div
      onClick={() => isViewable && onView(job.job_id)}
      className={`flex items-center gap-3 px-4 py-3.5 border-b last:border-0 transition-colors select-none
        ${isDark ? 'border-white/5' : 'border-slate-50'}
        ${isViewable ? isDark ? 'hover:bg-white/[0.025] cursor-pointer' : 'hover:bg-slate-50 cursor-pointer' : ''}`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
        ${isViewable ? isDark ? 'bg-indigo-500/10' : 'bg-indigo-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
        <SrcIcon size={13} className={isViewable ? 'text-indigo-400' : isDark ? 'text-slate-600' : 'text-slate-300'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate leading-tight
          ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {job.repository_name || 'Unnamed'}
        </p>
        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {relativeTime(job.created_at)}
        </p>
      </div>
      {badge ? (
        <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg ${badge.bg}`}
          style={{ color: badge.color }}>
          {badge.label}
        </span>
      ) : job.status === 'running' ? (
        <span className="text-[10px] text-indigo-400 font-semibold flex-shrink-0">
          {job.progress || 0}%
        </span>
      ) : null}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   DONUT LABEL
───────────────────────────────────────────────────────────── */
const renderDonutLabel = ({ cx, cy, total }) => (
  <>
    <text x={cx} y={cy - 8} textAnchor="middle" fontSize="28" fontWeight="900"
      fill="currentColor">{total}</text>
    <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fontWeight="600"
      fill="#64748b">total</text>
  </>
);

/* ─────────────────────────────────────────────────────────────
   DASHBOARD PAGE
───────────────────────────────────────────────────────────── */
const DashboardPage = () => {
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const { loadReport } = useScan();
  const { isDark }     = useTheme();
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(() => {
    setLoading(true);
    scanAPI.getJobs()
      .then(({ data }) => setJobs(Array.isArray(data) ? data : (data.jobs || [])))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  /* ── Derived data ── */
  const done  = jobs.filter(j => j.status === 'completed' || j.status === 'partial');
  const score = calcScore(jobs);

  /* Bar chart: last 12 scans */
  const barData = [...done].reverse().slice(-12).map((j, i) => ({
    name:     (j.repository_name || `S${i+1}`).split(/[/\\]/).pop()?.slice(0, 9) || `S${i+1}`,
    Critical: j.critical_count || 0,
    High:     j.high_count     || 0,
    Medium:   j.medium_count   || 0,
  }));

  /* Area chart: last 10 scans */
  const areaData = [...done].reverse().slice(-10).map((j, i) => ({
    name:     (j.repository_name || `S${i+1}`).split(/[/\\]/).pop()?.slice(0, 7) || `S${i+1}`,
    Total:    j.total_vulnerabilities || 0,
    Critical: j.critical_count        || 0,
    High:     j.high_count            || 0,
  }));

  /* Pie chart: aggregate distribution */
  const pieData = SEV_META
    .map(s => ({ name: s.label, value: done.reduce((a, j) => a + (j[s.key]||0), 0), color: s.color }))
    .filter(d => d.value > 0);
  const grandTotal = pieData.reduce((a, d) => a + d.value, 0);

  /* KPI values */
  const totalCritical = done.reduce((s, j) => s + (j.critical_count||0), 0);
  const totalHighRisk = done.reduce((s, j) => s + ((j.critical_count||0) + (j.high_count||0)), 0);
  const cleanCount    = done.filter(j => (j.total_vulnerabilities||0) === 0).length;
  const trendCrit     = done.length < 2 ? 0 : (done[0].critical_count||0) - (done[1].critical_count||0);
  const trendFindings = done.length < 2 ? 0 : (done[0].total_vulnerabilities||0) - (done[1].total_vulnerabilities||0);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };

  /* Theme-aware tokens */
  const tk = {
    pageBg:   isDark ? 'bg-[#0d0f17]'   : 'bg-[#f0f2f8]',
    cardBg:   isDark ? 'bg-[#161929]'   : 'bg-white',
    border:   isDark ? 'border-white/5' : 'border-slate-100',
    heading:  isDark ? 'text-white'     : 'text-slate-900',
    subtext:  isDark ? 'text-slate-400' : 'text-slate-500',
    label:    isDark ? 'text-slate-500' : 'text-slate-400',
    grid:     isDark ? '#1e2a3a'        : '#f1f5f9',
    axisText: isDark ? '#475569'        : '#94a3b8',
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tk.pageBg}`}>
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto" />
          <p className={`text-sm ${tk.subtext}`}>Loading your security data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${tk.pageBg} transition-colors duration-300`}>
      <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-widest mb-1.5 ${tk.label}`}>
              {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </p>
            <h1 className={`text-[2rem] font-black tracking-tight leading-none ${tk.heading}`}>
              Security Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchJobs}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors
                ${isDark
                  ? 'border-white/10 text-slate-300 hover:bg-white/5'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Activity size={14} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/scan')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600
                         hover:bg-indigo-500 text-white text-sm font-semibold
                         transition-colors shadow-lg shadow-indigo-900/40"
            >
              New Scan
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Row 1: Score ring + 4 KPI cards ──────────────── */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-4">
            <ScoreRing score={score} isDark={isDark} />
          </div>
          <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-5">
            <KpiCard label="Total Scans"    value={jobs.length}    sub={`${done.length} completed`}         icon={ShieldCheck}  accentColor="#6366f1" trend={undefined}    isDark={isDark} />
            <KpiCard label="Critical"       value={totalCritical}  sub="high-impact findings"                icon={AlertTriangle} accentColor="#f43f5e" trend={trendCrit}   isDark={isDark} />
            <KpiCard label="High Risk"      value={totalHighRisk}  sub="critical + high combined"           icon={ShieldAlert}  accentColor="#f97316" trend={undefined}    isDark={isDark} />
            <KpiCard label="Clean Scans"    value={cleanCount}     sub="zero vulnerabilities found"         icon={Shield}       accentColor="#22c55e" trend={undefined}    isDark={isDark} />
          </div>
        </div>

        {/* ── Row 2: Area chart (8) + Pie chart (4) ─────────── */}
        <div className="grid grid-cols-12 gap-5">

          {/* Area / Line chart */}
          <div className={`col-span-12 lg:col-span-8 rounded-2xl border p-6
            ${tk.cardBg} ${tk.border}`}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${tk.label}`}>
                  Vulnerability Trend
                </p>
                <p className={`text-sm font-semibold ${tk.subtext}`}>
                  {areaData.length > 0
                    ? `Last ${areaData.length} completed scans`
                    : 'Run your first scan to see trends'}
                </p>
              </div>
              {areaData.length > 0 && (
                <div className={`text-right px-3 py-2 rounded-xl border
                  ${isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Latest scan</p>
                  <p className="text-lg font-black text-indigo-400 tabular-nums">
                    {areaData[areaData.length-1]?.Total ?? 0}
                  </p>
                  <p className={`text-[10px] ${tk.subtext}`}>total findings</p>
                </div>
              )}
            </div>

            {areaData.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-[240px] rounded-xl border-2 border-dashed
                ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-300'}`}>
                <Activity size={32} className="mb-2" />
                <p className="text-sm">No completed scans yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={isDark ? 0.25 : 0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCrit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f43f5e" stopOpacity={isDark ? 0.2 : 0.12} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f97316" stopOpacity={isDark ? 0.18 : 0.1} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={tk.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tk.axisText, fontSize: 10, fontWeight: 600 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tk.axisText, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Legend iconType="circle" iconSize={7}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '12px', color: tk.axisText }} />
                  <Area type="monotone" dataKey="Total"    stroke="#6366f1" strokeWidth={2.5}
                    fill="url(#gradTotal)"    dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                  <Area type="monotone" dataKey="Critical" stroke="#f43f5e" strokeWidth={2.5}
                    fill="url(#gradCrit)"     dot={false} activeDot={{ r: 5, fill: '#f43f5e' }} />
                  <Area type="monotone" dataKey="High"     stroke="#f97316" strokeWidth={2.5}
                    fill="url(#gradHigh)"     dot={false} activeDot={{ r: 5, fill: '#f97316' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Donut chart */}
          <div className={`col-span-12 lg:col-span-4 rounded-2xl border p-6 flex flex-col
            ${tk.cardBg} ${tk.border}`}>
            <div className="mb-4">
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${tk.label}`}>
                Distribution
              </p>
              <p className={`text-sm font-semibold ${tk.subtext}`}>Vulnerability breakdown</p>
            </div>

            {pieData.length === 0 ? (
              <div className={`flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed
                ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-300'}`}>
                <Shield size={28} className="mb-2" />
                <p className="text-xs">No findings recorded</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  <div style={{ color: isDark ? '#fff' : '#0f172a' }}>
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                          dataKey="value" strokeWidth={0}
                          label={false}>
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip isDark={isDark} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Legend */}
                <div className="space-y-2 mt-3">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className={`text-xs flex-1 font-medium ${tk.subtext}`}>{d.name}</span>
                      <span className={`text-xs font-black tabular-nums ${tk.heading}`}>{d.value}</span>
                      <span className={`text-[10px] tabular-nums ${tk.label}`}>
                        {grandTotal ? Math.round((d.value/grandTotal)*100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Row 3: Bar chart (8) + Activity feed (4) ──────── */}
        <div className="grid grid-cols-12 gap-5">

          {/* Bar chart */}
          <div className={`col-span-12 lg:col-span-8 rounded-2xl border p-6
            ${tk.cardBg} ${tk.border}`}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${tk.label}`}>
                  Scan Analytics
                </p>
                <p className={`text-sm font-semibold ${tk.subtext}`}>
                  Findings per scan · last {barData.length || 0} scans
                </p>
              </div>
              <button onClick={() => navigate('/history')}
                className={`flex items-center gap-1 text-xs font-bold transition-colors
                  ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}>
                Full history <ChevronRight size={13} />
              </button>
            </div>

            {barData.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-[220px] rounded-xl border-2 border-dashed
                ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-300'}`}>
                <Activity size={28} className="mb-2" />
                <p className="text-xs">No data available</p>
                <button onClick={() => navigate('/scan')}
                  className="mt-3 text-xs font-bold text-indigo-400 hover:underline">
                  Start a scan →
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  barSize={20} barCategoryGap="30%">
                  <CartesianGrid stroke={tk.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tk.axisText, fontSize: 10, fontWeight: 600 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tk.axisText, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                  <Legend iconType="circle" iconSize={7}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '12px', color: tk.axisText }} />
                  <Bar dataKey="Critical" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="High"     fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Medium"   fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Activity sidebar */}
          <div className={`col-span-12 lg:col-span-4 rounded-2xl border overflow-hidden flex flex-col
            ${tk.cardBg} ${tk.border}`}>
            <div className={`px-4 py-4 border-b flex items-center justify-between ${tk.border}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${tk.label}`}>
                Recent Activity
              </p>
              <button onClick={() => navigate('/history')}
                className={`text-[10px] font-bold flex items-center gap-0.5 transition-colors
                  ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}>
                All <ChevronRight size={10} />
              </button>
            </div>
            {jobs.length === 0 ? (
              <div className={`flex-1 flex flex-col items-center justify-center py-12 gap-2 ${tk.label}`}>
                <Shield size={24} />
                <p className="text-xs">No scan history yet.</p>
                <button onClick={() => navigate('/scan')}
                  className="text-xs font-bold text-indigo-400 hover:underline">
                  Start scanning →
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[320px] flex-1">
                {jobs.slice(0, 20).map(job => (
                  <SidebarRow key={job.job_id} job={job} onView={loadReport} isDark={isDark} />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;

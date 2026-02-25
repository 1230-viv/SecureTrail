import React from 'react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, ShieldOff, Activity } from 'lucide-react';

const ROWS = [
  { key: 'critical_count', label: 'Critical',  icon: ShieldOff,  textColor: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500'    },
  { key: 'high_count',     label: 'High',     icon: AlertTriangle, textColor: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  { key: 'medium_count',   label: 'Medium',   icon: ShieldAlert, textColor: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  { key: 'low_count',      label: 'Low',      icon: Info,        textColor: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  { key: 'info_count',     label: 'Info',     icon: CheckCircle, textColor: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400'   },
];

/**
 * RiskSummary
 *
 * Props
 *   report : ScanReport | null
 */
const RiskSummary = ({ report }) => {
  const total = report?.total_vulnerabilities ?? 0;
  const hasData = report != null;

  // Bar graph: widths relative to total (minimum 4px for visibility)
  const barWidth = (count) => {
    if (!total || !count) return 0;
    return Math.max(4, Math.round((count / total) * 100));
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Activity size={20} className="text-blue-600" />
          Risk Summary
        </h2>
        {!hasData && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            no scan yet
          </span>
        )}
      </div>

      {/* Total count */}
      <div className="flex items-center justify-between py-3 border-b border-gray-200 mb-3">
        <span className="text-gray-600 font-medium">Total Vulnerabilities</span>
        <span className={`text-3xl font-bold ${hasData && total > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
          {total}
        </span>
      </div>

      {/* Per-severity rows */}
      <div className="space-y-2.5">
        {ROWS.map(({ key, label, icon: Icon, textColor, bg, border, dot }) => {
          const count = report?.[key] ?? 0;
          const pct   = barWidth(count);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
                <span className={`text-sm font-bold ${count > 0 ? textColor : 'text-gray-300'}`}>
                  {count}
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                {count > 0 && (
                  <div
                    className={`h-1.5 rounded-full ${dot} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scanner coverage chips (only when report available) */}
      {hasData && report.scanner_results && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Scanner Coverage</p>
          <div className="flex flex-wrap gap-1.5">
            {['semgrep', 'trivy', 'gitleaks'].map(name => {
              const meta = report.scanner_results[name];
              const ran  = meta !== undefined;
              const err  = meta?.error;
              return (
                <span key={name}
                  className={`text-xs px-2 py-0.5 rounded border capitalize font-medium
                    ${err   ? 'bg-red-50 border-red-200 text-red-600'
                    : ran   ? 'bg-green-50 border-green-200 text-green-700'
                    :         'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  {name}
                  {err ? ' ✗' : ran ? ' ✓' : ' —'}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskSummary;


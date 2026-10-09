import React from 'react';
import { formatNumber } from '../../utils/formatters';

export const KpiCard = ({ label, value, subtext, highlight = false, badgeText = null, badgeClass = '' }) => {
  return (
    <div className={`bg-card p-5 rounded-xl border transition-all duration-150 shadow-subtle flex flex-col justify-between ${
      highlight ? 'border-signal/40 bg-signal-light/30' : 'border-line hover:border-slate/40'
    }`}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="text-2xl sm:text-3xl font-semibold text-ink tabular-nums tracking-tight leading-none">
            {formatNumber(value)}
          </div>
          {badgeText && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded shrink-0 ${badgeClass || 'bg-surface border border-line text-slate'}`}>
              {badgeText}
            </span>
          )}
        </div>

        <div className="text-xs font-medium text-slate mt-2 leading-snug">
          {label}
        </div>
      </div>

      {subtext && (
        <div className="text-[11px] text-slate/80 mt-3 pt-2.5 border-t border-line/60">
          {subtext}
        </div>
      )}
    </div>
  );
};

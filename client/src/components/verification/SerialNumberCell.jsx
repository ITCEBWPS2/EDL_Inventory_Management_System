import React, { useState, useEffect } from 'react';

/**
 * SerialNumberCell
 * Renders serial numbers stacked vertically in monospace format, strictly 1 line per serial (no wrapping).
 * For batches with > 3 serials:
 * - Shows only the first 3 serials by default.
 * - Displays "+ N more" button to expand (with max-height ~240px scroll if > 10 serials).
 * - "Show less" button to collapse.
 * - Defaults to collapsed, and auto-resets on search or filter change.
 * In Print mode: shows all serials without collapse.
 */
export const SerialNumberCell = ({
  serialNumbers = [],
  manufacturerSerialNumbers = [],
  singleSerial = '',
  singleMfg = '',
  searchQuery = '',
  resetTrigger = null,
  isPrint = false
}) => {
  const [expanded, setExpanded] = useState(false);

  // Auto-collapse when search query or filter changes
  useEffect(() => {
    setExpanded(false);
  }, [searchQuery, resetTrigger]);

  // Normalize serial numbers list
  const serials = Array.isArray(serialNumbers) && serialNumbers.length > 0
    ? serialNumbers.filter(Boolean)
    : (singleSerial ? [singleSerial] : []);

  const mfgs = Array.isArray(manufacturerSerialNumbers) && manufacturerSerialNumbers.length > 0
    ? manufacturerSerialNumbers
    : (singleMfg ? [singleMfg] : []);

  if (serials.length === 0) {
    return <span className="text-slate font-mono text-xs whitespace-nowrap">—</span>;
  }

  const isBatch = serials.length > 1;
  const isCollapsible = !isPrint && serials.length > 3;
  const isExpandedView = isPrint || expanded || !isCollapsible;
  const visibleSerials = isExpandedView ? serials : serials.slice(0, 3);
  const remainingCount = serials.length - 3;
  const q = searchQuery ? searchQuery.toLowerCase().trim() : '';

  // Limit height to ~240px with its own scrollbar when expanded with many serials (> 10)
  const needsScroll = expanded && serials.length > 10;

  return (
    <div className="font-mono text-xs select-text w-full">
      {/* Batch Badge for multi-serial items */}
      {isBatch && (
        <div className="flex items-center gap-1.5 mb-1.5 no-print">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-surface border border-line text-slate tracking-tight select-none">
            {serials.length} serials
          </span>
        </div>
      )}

      {/* Stacked Serials List strictly 1 line per serial */}
      <div
        className={`space-y-1 ${
          needsScroll ? 'max-h-[240px] overflow-y-auto pr-1.5 scrollbar-thin' : ''
        }`}
      >
        {visibleSerials.map((sn, idx) => {
          const mfg = mfgs[idx] || (idx === 0 ? singleMfg : '');
          const isMatched = q && sn && sn.toLowerCase().includes(q);

          return (
            <div
              key={`${sn}-${idx}`}
              className="leading-[1.35] whitespace-nowrap overflow-hidden text-ellipsis flex items-baseline gap-1"
            >
              <span
                className={`font-mono font-semibold text-ink whitespace-nowrap ${
                  isMatched ? 'bg-amber-100 text-amber-900 px-1 rounded shadow-xs' : ''
                }`}
                title={sn}
              >
                {sn}
              </span>
              {mfg ? (
                <span
                  className="text-[10px] text-slate font-sans font-normal whitespace-nowrap shrink-0"
                  title={`Manufacturer S/N: ${mfg}`}
                >
                  (Mfg: <span className="font-mono text-slate/90">{mfg}</span>)
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* "+ N more" / "Show less" Expand Link */}
      {isCollapsible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(prev => !prev);
          }}
          className="mt-1.5 text-[11px] font-sans font-semibold text-signal hover:underline inline-flex items-center gap-0.5 cursor-pointer no-print select-none"
        >
          {expanded ? 'Show less' : `+ ${remainingCount} more`}
        </button>
      )}
    </div>
  );
};

export default SerialNumberCell;


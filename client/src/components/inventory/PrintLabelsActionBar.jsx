import React from 'react';
import { Printer, X, CheckSquare } from 'lucide-react';

/**
 * Sticky action bar displayed when one or more serial numbers are selected
 */
export const PrintLabelsActionBar = ({
  selectedCount = 0,
  totalFilteredCount = 0,
  onPrint = () => {},
  onClear = () => {},
  onSelectAllFiltered = () => {}
}) => {
  if (selectedCount === 0) return null;

  const canSelectMoreInList = totalFilteredCount > 0 && selectedCount < totalFilteredCount;

  return (
    <div
      id="serial-selection-sticky-bar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ink text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border border-line/30 flex flex-wrap items-center justify-between gap-3 sm:gap-6 animate-in slide-in-from-bottom-5 duration-200 no-print max-w-[92vw]"
      role="region"
      aria-label="Serial selection toolbar"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center bg-signal text-ink font-bold text-xs rounded-full min-w-5 h-5 px-1.5 shadow-xs tabular-nums">
          {selectedCount}
        </span>
        <div className="text-xs font-semibold text-white">
          <span>{selectedCount} serial number{selectedCount > 1 ? 's' : ''} selected</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {canSelectMoreInList && (
          <button
            type="button"
            id="btn-select-all-filtered-serials"
            onClick={onSelectAllFiltered}
            className="px-2.5 py-1.5 rounded-lg bg-surface/10 hover:bg-surface/20 text-signal hover:text-signal-light text-xs font-medium transition-colors flex items-center gap-1.5"
            title={`Select all ${totalFilteredCount} serial numbers in current filtered list`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Select all {totalFilteredCount} in this list</span>
          </button>
        )}

        <button
          type="button"
          id="btn-clear-serial-selection"
          onClick={onClear}
          className="px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-surface/10 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1"
          title="Clear selected serials"
        >
          <X className="w-3.5 h-3.5" />
          <span>Clear selection</span>
        </button>

        <button
          type="button"
          id="btn-print-selected-labels"
          onClick={onPrint}
          className="px-4 py-1.5 rounded-xl bg-signal hover:bg-signal-hover text-ink font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 active:scale-95"
          title="Open print labels dialog for selected serials"
        >
          <Printer className="w-4 h-4 text-ink" />
          <span>Print Labels</span>
        </button>
      </div>
    </div>
  );
};


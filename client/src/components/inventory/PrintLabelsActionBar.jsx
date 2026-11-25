import React from 'react';
import { Printer, X, CheckSquare } from 'lucide-react';
import { Button } from '../common/Button';

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
          <Button
            variant="ghost"
            size="small"
            id="btn-select-all-filtered-serials"
            onClick={onSelectAllFiltered}
            title={`Select all ${totalFilteredCount} serial numbers in current filtered list`}
            icon={CheckSquare}
            label={`Select all ${totalFilteredCount} in this list`}
            className="!text-signal hover:!text-signal-light !bg-surface/10 hover:!bg-surface/20 border-0"
          />
        )}

        <Button
          variant="ghost"
          size="small"
          id="btn-clear-serial-selection"
          onClick={onClear}
          title="Clear selected serials"
          icon={X}
          label="Clear selection"
          className="!text-slate-300 hover:!text-white hover:!bg-surface/10 border-0"
        />

        <Button
          variant="primary"
          size="regular"
          id="btn-print-selected-labels"
          onClick={onPrint}
          title="Open print labels dialog for selected serials"
          icon={Printer}
          label="Print Labels"
          className="!bg-[#f6c026] !text-[#280818] hover:!bg-[#e5af1d] !border-0 font-bold shadow-md"
        />
      </div>
    </div>
  );
};


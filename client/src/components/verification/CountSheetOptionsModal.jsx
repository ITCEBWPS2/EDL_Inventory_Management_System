import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Printer, FileDown, X } from 'lucide-react';
import { Button } from '../common/Button';
import {
  buildCountSheetData,
  saveStoredCountSheetOptions
} from '../../utils/countSheetBuilder';

/**
 * CountSheetOptionsModal
 * Options dialog allowing the user to configure scope, columns, grouping, and pagination
 * before printing or downloading the editable Word (.docx) count sheet.
 */
export const CountSheetOptionsModal = ({
  isOpen,
  onClose,
  allItems = [],
  filteredItems = [],
  metadata = {},
  initialOptions = {},
  onPrint,
  onDownloadDocx
}) => {
  const [options, setOptions] = useState(initialOptions);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const modalRef = useRef(null);

  // Sync initial options when modal opens
  useEffect(() => {
    if (isOpen) {
      setOptions(prev => ({ ...prev, ...initialOptions }));
    }
  }, [isOpen, initialOptions]);

  // Compute live data preview based on active options
  const previewData = useMemo(() => {
    return buildCountSheetData(allItems, filteredItems, options);
  }, [allItems, filteredItems, options]);

  // Handle option changes and persist
  const handleOptionChange = (key, value) => {
    setOptions(prev => {
      const next = { ...prev, [key]: value };
      saveStoredCountSheetOptions(next);
      return next;
    });
  };

  const handlePrintClick = useCallback(async () => {
    if (previewData.totalItems === 0 || isPrinting || isGeneratingDocx) return;
    saveStoredCountSheetOptions(options);
    setIsPrinting(true);
    try {
      if (onPrint) {
        await onPrint(options, previewData);
      }
    } finally {
      setIsPrinting(false);
    }
  }, [options, previewData, isPrinting, isGeneratingDocx, onPrint]);

  const handleDocxClick = async () => {
    if (previewData.totalItems === 0 || isPrinting || isGeneratingDocx) return;
    saveStoredCountSheetOptions(options);
    try {
      setIsGeneratingDocx(true);
      if (onDownloadDocx) {
        await onDownloadDocx(options, previewData);
      }
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  // Focus trapping and keyboard shortcuts (Escape to close, Enter to print)
  useEffect(() => {
    if (!isOpen) return;

    const modalElement = modalRef.current;
    if (modalElement) {
      const focusableElements = modalElement.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        const tag = (e.target?.tagName || '').toLowerCase();
        // Do not trigger if focus is currently in an input, select, textarea, or button
        if (tag !== 'input' && tag !== 'select' && tag !== 'textarea' && tag !== 'button') {
          e.preventDefault();
          handlePrintClick();
        }
      }
      if (e.key === 'Tab' && modalElement) {
        const focusables = modalElement.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrintClick]);

  if (!isOpen) return null;

  const totalAll = (allItems || []).length;
  const totalFiltered = (filteredItems || []).length;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto no-print animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="count-sheet-modal-title"
      ref={modalRef}
    >
      <div className="bg-card border border-line rounded-2xl shadow-modal w-full max-w-lg overflow-hidden my-6 flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 bg-surface/50 border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-maroon-tint text-maroon flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4 text-maroon" />
            </div>
            <div>
              <h3 id="count-sheet-modal-title" className="text-sm font-bold text-ink">
                Print Verification Count Sheet
              </h3>
              <p className="text-xs text-slate">
                Generate a blank landscape A4 physical count form for store verifiers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate hover:text-ink hover:bg-surface transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Summary Banner */}
        <div className="mx-5 mt-4 p-3 bg-maroon-tint/50 border border-maroon-tint rounded-xl flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-maroon shrink-0" />
            <span className="font-semibold text-ink">
              {previewData.totalItems} {previewData.totalItems === 1 ? 'item' : 'items'} on about{' '}
              <span className="text-maroon font-bold">{previewData.estimatedPages}</span>{' '}
              {previewData.estimatedPages === 1 ? 'page' : 'pages'} (A4 Landscape)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate">
            Unit: {metadata.unitName || 'Selected'}
          </span>
        </div>

        {/* Options Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* 1. Item Scope */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Item Scope
            </label>
            <div className="space-y-2">
              {/* Scope: All */}
              <label
                className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  options.scope === 'all'
                    ? 'border-maroon bg-maroon-tint/30 text-ink'
                    : 'border-line hover:border-slate/50 bg-card text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="count-sheet-scope"
                  value="all"
                  checked={options.scope === 'all'}
                  onChange={() => handleOptionChange('scope', 'all')}
                  className="mt-0.5 text-maroon focus:ring-maroon"
                />
                <div className="flex-1 text-xs">
                  <div className="font-semibold">All items of this unit</div>
                  <div className="text-slate text-[11px]">
                    Complete inventory list for {metadata.unitName || 'the unit'} ({totalAll} items)
                  </div>
                </div>
              </label>

              {/* Scope: Filtered */}
              <label
                className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  options.scope === 'filtered'
                    ? 'border-maroon bg-maroon-tint/30 text-ink'
                    : 'border-line hover:border-slate/50 bg-card text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="count-sheet-scope"
                  value="filtered"
                  checked={options.scope === 'filtered'}
                  onChange={() => handleOptionChange('scope', 'filtered')}
                  className="mt-0.5 text-maroon focus:ring-maroon"
                />
                <div className="flex-1 text-xs">
                  <div className="font-semibold">Only items currently shown</div>
                  <div className="text-slate text-[11px]">
                    Matches current search and category filter ({totalFiltered} items)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 2. Layout & Columns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-line">
            {/* Show System Qty Column */}
            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface/50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={options.showSystemQty}
                onChange={(e) => handleOptionChange('showSystemQty', e.target.checked)}
                className="mt-0.5 rounded border-line text-maroon focus:ring-maroon"
              />
              <div>
                <span className="font-semibold text-ink">Show "System Qty"</span>
                <p className="text-[11px] text-slate">Turn off for a blind count</p>
              </div>
            </label>

            {/* Group by Category */}
            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface/50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={options.groupByCategory}
                onChange={(e) => handleOptionChange('groupByCategory', e.target.checked)}
                className="mt-0.5 rounded border-line text-maroon focus:ring-maroon"
              />
              <div>
                <span className="font-semibold text-ink">Group by category</span>
                <p className="text-[11px] text-slate">Heading row per category band</p>
              </div>
            </label>

            {/* Include Signature Block */}
            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface/50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={options.includeSignatureBlock}
                onChange={(e) => handleOptionChange('includeSignatureBlock', e.target.checked)}
                className="mt-0.5 rounded border-line text-maroon focus:ring-maroon"
              />
              <div>
                <span className="font-semibold text-ink">Include signature block</span>
                <p className="text-[11px] text-slate">3 verifiers + Unit Head</p>
              </div>
            </label>

            {/* Prefill Header Fields */}
            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface/50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={options.prefillHeader}
                onChange={(e) => handleOptionChange('prefillHeader', e.target.checked)}
                className="mt-0.5 rounded border-line text-maroon focus:ring-maroon"
              />
              <div>
                <span className="font-semibold text-ink">Prefill header fields</span>
                <p className="text-[11px] text-slate">Use typed Date & Verifiers</p>
              </div>
            </label>
          </div>

          {/* 3. Rows per page selector */}
          <div className="pt-2 border-t border-line flex items-center justify-between">
            <div>
              <label htmlFor="rows-per-page-select" className="text-xs font-bold text-ink">
                Rows per page
              </label>
              <p className="text-[11px] text-slate">Page division target</p>
            </div>
            <select
              id="rows-per-page-select"
              value={options.rowsPerPage}
              onChange={(e) => handleOptionChange('rowsPerPage', e.target.value)}
              className="text-xs bg-card border border-line rounded-lg py-1 px-2.5 text-ink font-medium focus:outline-none focus:border-signal"
            >
              <option value="auto">Automatic (fit to page)</option>
              <option value="12">12 rows / page</option>
              <option value="15">15 rows / page</option>
              <option value="20">20 rows / page</option>
            </select>
          </div>
        </div>

        {/* Footer Actions - Sticky Bottom */}
        <div className="sticky bottom-0 bg-surface/95 backdrop-blur-xs border-t border-line px-5 py-3 flex items-center justify-between gap-2 z-10 shrink-0">
          <Button
            variant="secondary"
            size="regular"
            onClick={onClose}
            className="!h-9 !px-4 text-xs font-semibold"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {/* Word (.docx) Button */}
            <Button
              variant="secondary"
              size="regular"
              icon={FileDown}
              iconSize={15}
              onClick={handleDocxClick}
              loading={isGeneratingDocx}
              disabled={isPrinting || previewData.totalItems === 0}
              title="Download editable Microsoft Word count sheet"
              className="!h-9 !px-3.5 text-xs font-semibold"
            >
              Download Word
            </Button>

            {/* Print Button */}
            <Button
              variant="primary"
              size="regular"
              icon={Printer}
              iconSize={15}
              onClick={handlePrintClick}
              loading={isPrinting}
              disabled={isGeneratingDocx || previewData.totalItems === 0}
              title="Open browser print dialog for A4 landscape count sheet"
              className="!h-9 !px-4 text-xs font-semibold"
            >
              Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountSheetOptionsModal;

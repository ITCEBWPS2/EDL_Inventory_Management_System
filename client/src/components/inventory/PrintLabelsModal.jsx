import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { Button } from '../common/Button';
import {
  Printer,
  X,
  FileDown,
  Settings,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  LABEL_PRESETS,
  PAGE_DIMENSIONS,
  DEFAULT_PRINT_OPTIONS,
  calculateSheetLayout,
  calculateSerialFontSize,
  buildPrintItems,
  loadSavedPrintOptions,
  savePrintOptions
} from '../../utils/labelLayout';
import { QrCodeImage } from './QrCodeImage';

/**
 * Unified component for rendering individual label content
 * Used in Sheet Preview and Print Output to guarantee 100% visual parity.
 */
export const LabelCellContent = ({
  item,
  labelWidthMm,
  labelHeightMm,
  options,
  isPrint = false
}) => {
  if (!item || item.isEmpty) {
    return (
      <div className="w-full h-full border border-dashed border-slate/30 flex items-center justify-center bg-slate/5 box-border">
        {!isPrint && <span className="text-[8pt] text-slate/40 font-mono">Empty</span>}
      </div>
    );
  }

  const { fontSizePt, qrSize } = calculateSerialFontSize({
    serial: item.serial,
    labelWidthMm,
    labelHeightMm,
    hasQr: options.showQrCode,
    hasItemName: options.showItemName,
    minFontPt: 5,
    maxFontPt: 14
  });

  const itemNameFontPt = Math.max(4.5, Math.min(8, Number((fontSizePt * 0.72).toFixed(1))));

  const borderClass = isPrint
    ? options.showCutLines ? 'border border-dashed border-black' : ''
    : options.showCutLines ? 'border border-dashed border-black/50' : 'border border-slate/20';

  return (
    <div
      className={`w-full h-full flex items-center overflow-hidden box-border bg-white text-black ${borderClass}`}
      style={{
        padding: '2mm',
        width: `${labelWidthMm}mm`,
        height: `${labelHeightMm}mm`,
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      {options.showQrCode && (
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: `${qrSize}mm`,
            height: `${qrSize}mm`,
            marginRight: '2.5mm'
          }}
        >
          <QrCodeImage
            value={item.serial}
            size={Math.round(qrSize * 3.78)}
            className="w-full h-full"
          />
        </div>
      )}

      <div
        className={`flex-1 min-w-0 flex flex-col justify-center overflow-hidden ${
          options.showQrCode ? 'items-start text-left' : 'items-center text-center'
        }`}
      >
        <div
          className="font-mono font-bold text-black tracking-tight select-all whitespace-nowrap overflow-hidden"
          style={{
            fontSize: `${fontSizePt}pt`,
            lineHeight: 1.15,
            maxWidth: '100%',
            textAlign: options.showQrCode ? 'left' : 'center'
          }}
          title={item.serial}
        >
          {item.serial}
        </div>

        {options.showItemName && item.itemName && (
          <div
            className="font-sans font-medium text-slate-700 truncate whitespace-nowrap overflow-hidden"
            style={{
              fontSize: `${itemNameFontPt}pt`,
              lineHeight: 1.1,
              marginTop: '1mm',
              maxWidth: '100%',
              textAlign: options.showQrCode ? 'left' : 'center'
            }}
            title={item.itemName}
          >
            {item.itemName}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * PrintLabelsModal - Modal dialog for previewing and printing serial labels
 */
export const PrintLabelsModal = ({
  isOpen,
  onClose,
  itemsToPrint = [] // Array<{ serial: string, itemName?: string, itemId?: string }>
}) => {
  // Load persisted user preferences
  const [options, setOptions] = useState(() => loadSavedPrintOptions());
  const [currentPage, setCurrentPage] = useState(0);
  const [showAdvancedMargins, setShowAdvancedMargins] = useState(false);
  const [confirmedLargePrint, setConfirmedLargePrint] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const previewContainerRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const leftPanelRef = useRef(null);
  const isBackdropMouseDownRef = useRef(false);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(440);

  // Measure preview container for accurate proportional scaling
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const updateWidth = () => {
      if (previewContainerRef.current) {
        const w = previewContainerRef.current.clientWidth;
        if (w > 0) setPreviewContainerWidth(w);
      }
    };
    updateWidth();
    const obs = new ResizeObserver(updateWidth);
    obs.observe(previewContainerRef.current);
    return () => obs.disconnect();
  }, [isOpen]);

  // Sync / save options to localStorage
  useEffect(() => {
    savePrintOptions(options);
  }, [options]);

  // Reset page index and confirmation when items or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
      setConfirmedLargePrint(false);
    }
  }, [isOpen, itemsToPrint]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen]);

  // Accessibility: focus trap, scroll settings to top on open, and keyboard listeners (Esc / Tab)
  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement;

    // Scroll settings panel to the top when dialog opens
    leftPanelRef.current?.scrollTo({ top: 0, behavior: 'instant' });

    // Move initial focus into modal
    const focusTimer = setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelector(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        focusable?.focus();
      }
    }, 40);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  // Resolve current active preset
  const activePreset = useMemo(() => {
    return LABEL_PRESETS[options.presetId] || LABEL_PRESETS['90x25'];
  }, [options.presetId]);

  // Effective label dimensions in mm
  const effectiveLabelWidth = useMemo(() => {
    if (options.presetId === 'custom') {
      return Number(options.customWidthMm) || 90;
    }
    return activePreset.widthMm;
  }, [options.presetId, options.customWidthMm, activePreset]);

  const effectiveLabelHeight = useMemo(() => {
    if (options.presetId === 'custom') {
      return Number(options.customHeightMm) || 25;
    }
    return activePreset.heightMm;
  }, [options.presetId, options.customHeightMm, activePreset]);

  // Effective margins & gaps in mm
  const effectiveMargins = useMemo(() => {
    if (options.presetId === 'custom' || showAdvancedMargins) {
      return {
        top: Number(options.marginTopMm) ?? 11,
        bottom: Number(options.marginBottomMm) ?? 11,
        left: Number(options.marginLeftMm) ?? 10,
        right: Number(options.marginRightMm) ?? 10,
        gapX: Number(options.gapXMm) ?? 5,
        gapY: Number(options.gapYMm) ?? 0
      };
    }
    return {
      top: activePreset.marginTopMm ?? 11,
      bottom: activePreset.marginBottomMm ?? 11,
      left: activePreset.marginLeftMm ?? 10,
      right: activePreset.marginRightMm ?? 10,
      gapX: activePreset.gapXMm ?? 5,
      gapY: activePreset.gapYMm ?? 0
    };
  }, [options, activePreset, showAdvancedMargins]);

  // Sheet grid layout calculation
  const sheetLayout = useMemo(() => {
    if (options.layoutMode === 'roll') {
      return {
        columns: 1,
        rows: 1,
        labelsPerPage: 1,
        availableWidth: effectiveLabelWidth,
        availableHeight: effectiveLabelHeight,
        labelWidthMm: effectiveLabelWidth,
        labelHeightMm: effectiveLabelHeight
      };
    }
    return calculateSheetLayout({
      pageWidthMm: PAGE_DIMENSIONS.A4.widthMm,
      pageHeightMm: PAGE_DIMENSIONS.A4.heightMm,
      labelWidthMm: effectiveLabelWidth,
      labelHeightMm: effectiveLabelHeight,
      marginTopMm: effectiveMargins.top,
      marginBottomMm: effectiveMargins.bottom,
      marginLeftMm: effectiveMargins.left,
      marginRightMm: effectiveMargins.right,
      gapXMm: effectiveMargins.gapX,
      gapYMm: effectiveMargins.gapY
    });
  }, [options.layoutMode, effectiveLabelWidth, effectiveLabelHeight, effectiveMargins]);

  // Build printable items chunked by page
  const printData = useMemo(() => {
    return buildPrintItems({
      items: itemsToPrint,
      copies: options.copies,
      startPosition: options.layoutMode === 'roll' ? 1 : options.startPosition,
      layoutMode: options.layoutMode || 'sheet',
      labelsPerPage: sheetLayout.labelsPerPage
    });
  }, [itemsToPrint, options.copies, options.startPosition, options.layoutMode, sheetLayout.labelsPerPage]);

  const totalPages = printData.totalPages;
  const safeCurrentPage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const activePageItems = printData.pages[safeCurrentPage] || [];

  const isLargePrintJob = printData.totalLabels > 100;

  // Check if any serial number is too long to fit even at minimum font size (5pt)
  const labelTooNarrowWarning = useMemo(() => {
    const itemsToCheck = itemsToPrint && itemsToPrint.length > 0 ? itemsToPrint : [];
    for (const it of itemsToCheck) {
      if (!it.serial) continue;
      const res = calculateSerialFontSize({
        serial: it.serial,
        labelWidthMm: effectiveLabelWidth,
        labelHeightMm: effectiveLabelHeight,
        hasQr: options.showQrCode,
        hasItemName: options.showItemName,
        minFontPt: 5,
        maxFontPt: 14
      });
      if (!res.fits) {
        return true;
      }
    }
    return false;
  }, [itemsToPrint, effectiveLabelWidth, effectiveLabelHeight, options.showQrCode, options.showItemName]);

  // Scaling calculations for visual preview
  const a4WidthPx = 210 * 3.779527; // ≈ 793.7px
  const a4HeightPx = 297 * 3.779527; // ≈ 1122.5px
  const targetSheetWidthPx = Math.min(previewContainerWidth - 24, 440);
  const sheetScale = Math.max(0.2, targetSheetWidthPx / a4WidthPx);

  const rollWidthPx = effectiveLabelWidth * 3.779527;
  const rollHeightPx = effectiveLabelHeight * 3.779527;
  const rollScale = Math.min(
    Math.max(0.6, (previewContainerWidth - 48) / rollWidthPx),
    300 / Math.max(1, rollHeightPx),
    2.2
  );

  // Execute browser print
  const handlePrint = () => {
    if (isLargePrintJob && !confirmedLargePrint) {
      alert(`Notice: This print job will print ${printData.totalLabels} labels over ${totalPages} pages. Please check the confirmation box to proceed.`);
      return;
    }
    setIsPrinting(true);
    document.body.classList.add('printing-serial-labels');

    try {
      api.post('/audit-logs/log-action', {
        action: 'PRINT',
        module: 'Inventory',
        entity_type: 'SerialLabels',
        description: `Printed ${printData.totalLabels} serial label(s) for ${itemsToPrint.length} item(s)`
      }).catch(() => {});
    } catch {}

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-serial-labels');
        setIsPrinting(false);
      }, 500);
    }, 100);
  };

  const handleDownloadPdf = () => {
    alert("To save as PDF, click 'Print Labels' and select 'Save as PDF' from your printer destination list in the print dialog.");
    handlePrint();
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return (
    <>
      {/* Modal Dialog for Screen View - Portalled to document.body */}
      {createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-ink/75 backdrop-blur-xs overflow-hidden no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-labels-modal-title"
          onMouseDown={(e) => {
            isBackdropMouseDownRef.current = (e.target === e.currentTarget);
          }}
          onMouseUp={(e) => {
            if (e.target !== e.currentTarget) {
              isBackdropMouseDownRef.current = false;
            }
          }}
          onClick={(e) => {
            if (isBackdropMouseDownRef.current && e.target === e.currentTarget) {
              onClose();
            }
            isBackdropMouseDownRef.current = false;
          }}
        >
          <div
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative w-full max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] rounded-2xl border border-line bg-card shadow-2xl flex flex-col overflow-hidden m-auto shrink-0 animate-scale-up"
            style={{
              width: 'min(1100px, calc(100vw - 32px))'
            }}
          >
            {/* Header - Fixed at top, flex: 0 0 auto */}
            <div
              className="p-3.5 sm:p-4 border-b border-line flex items-center justify-between bg-surface/80 shrink-0 select-none"
              style={{ flex: '0 0 auto' }}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-signal/15 text-signal flex items-center justify-center shrink-0">
                  <Printer className="w-4 h-4" />
                </span>
                <div>
                  <h2 id="print-labels-modal-title" className="font-semibold text-ink text-sm sm:text-base">
                    Print Serial Labels
                  </h2>
                  <p className="text-[11px] text-slate">
                    <span className="font-semibold text-ink">{printData.totalLabels}</span> labels to print &bull;{' '}
                    <span className="font-semibold text-ink">{itemsToPrint.length}</span> unique serial numbers &bull;{' '}
                    <span className="font-semibold text-ink">{totalPages}</span> {options.layoutMode === 'roll' ? 'label(s)' : 'sheet(s)'}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close dialog"
                title="Close dialog (Esc)"
                icon={X}
              />
            </div>

            {/* Modal Body: Left Controls, Right Preview */}
            <div
              className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line max-lg:overflow-y-auto"
              style={{ flex: '1 1 auto', minHeight: 0 }}
            >
              {/* Left Controls Panel - Scrollable with its own scrollbar */}
              <div
                ref={leftPanelRef}
                className="lg:col-span-5 p-4 sm:p-5 space-y-4 overflow-y-auto min-h-0 text-xs bg-surface/20"
                style={{ minHeight: 0 }}
              >
                {/* Narrow Label Warning Banner */}
                {labelTooNarrowWarning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <strong>Label too narrow for this serial number:</strong> increase the label width or select a wider preset.
                    </div>
                  </div>
                )}

                {/* Printer Layout Type: Sheet A4 vs Roll Single */}
                <div>
                  <label className="block font-semibold text-ink mb-1.5 uppercase text-[10px] tracking-wider text-slate">
                    Printer Layout Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOptions(o => ({ ...o, layoutMode: 'sheet' }))}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        (options.layoutMode || 'sheet') === 'sheet'
                          ? 'border-signal bg-signal/10 text-ink ring-1 ring-signal'
                          : 'border-line bg-card hover:bg-surface text-slate'
                      }`}
                    >
                      <div className="font-semibold text-xs text-ink flex items-center justify-between">
                        <span>Sheet (A4)</span>
                        {(options.layoutMode || 'sheet') === 'sheet' && (
                          <span className="w-2 h-2 rounded-full bg-signal" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate mt-0.5 leading-tight">
                        Multi-sticker grid on A4 paper
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOptions(o => ({ ...o, layoutMode: 'roll' }))}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        options.layoutMode === 'roll'
                          ? 'border-signal bg-signal/10 text-ink ring-1 ring-signal'
                          : 'border-line bg-card hover:bg-surface text-slate'
                      }`}
                    >
                      <div className="font-semibold text-xs text-ink flex items-center justify-between">
                        <span>Roll / Single</span>
                        {options.layoutMode === 'roll' && (
                          <span className="w-2 h-2 rounded-full bg-signal" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate mt-0.5 leading-tight">
                        Continuous thermal roll (1 / page)
                      </div>
                    </button>
                  </div>
                </div>

                {/* Label Size Preset */}
                <div>
                  <label className="block font-semibold text-ink mb-1.5 uppercase text-[10px] tracking-wider text-slate">
                    Label Size Preset
                  </label>
                  <div className="space-y-1.5">
                    {Object.values(LABEL_PRESETS).map((preset) => {
                      const isSelected = options.presetId === preset.id;
                      return (
                        <label
                          key={preset.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-signal bg-signal/10 text-ink'
                              : 'border-line bg-card hover:bg-surface/80 text-slate'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="presetId"
                              checked={isSelected}
                              onChange={() => setOptions(o => ({ ...o, presetId: preset.id }))}
                              className="w-3.5 h-3.5 accent-signal text-signal cursor-pointer"
                            />
                            <div>
                              <div className="font-semibold text-ink text-xs">{preset.label}</div>
                              {preset.id !== 'custom' && (
                                <div className="text-[10px] text-slate">
                                  {options.layoutMode === 'roll'
                                    ? `${preset.widthMm} × ${preset.heightMm} mm (Single label)`
                                    : `${preset.defaultColumns} cols × ${preset.defaultRows} rows = ${preset.defaultColumns * preset.defaultRows} labels / sheet`}
                                </div>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Custom Size Inputs */}
                  {options.presetId === 'custom' && (
                    <div className="mt-3 p-3 bg-surface rounded-lg border border-line grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate mb-1">Width (mm)</label>
                        <input
                          type="number"
                          min="20"
                          max="210"
                          value={options.customWidthMm}
                          onChange={(e) => setOptions(o => ({ ...o, customWidthMm: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-card border border-line rounded text-xs font-mono text-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate mb-1">Height (mm)</label>
                        <input
                          type="number"
                          min="10"
                          max="297"
                          value={options.customHeightMm}
                          onChange={(e) => setOptions(o => ({ ...o, customHeightMm: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-card border border-line rounded text-xs font-mono text-ink"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Quantity & Sheet Position */}
                <div className={`grid ${options.layoutMode === 'roll' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                  <div>
                    <label className="block font-semibold text-ink mb-1">Copies per serial</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={options.copies}
                      onChange={(e) => setOptions(o => ({ ...o, copies: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                      className="w-full px-3 py-1.5 bg-card border border-line rounded text-xs font-mono font-medium text-ink"
                    />
                  </div>

                  {options.layoutMode !== 'roll' && (
                    <div>
                      <label className="block font-semibold text-ink mb-1" title="Reuse partly used sticker sheets">
                        Start at position
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={sheetLayout.labelsPerPage || 100}
                        value={options.startPosition}
                        onChange={(e) => setOptions(o => ({ ...o, startPosition: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                        className="w-full px-3 py-1.5 bg-card border border-line rounded text-xs font-mono font-medium text-ink"
                        title="Skips used stickers on the first sheet"
                      />
                    </div>
                  )}
                </div>

                {/* Content Options */}
                <div>
                  <label className="block font-semibold text-ink mb-1.5 uppercase text-[10px] tracking-wider text-slate">
                    Content Options
                  </label>
                  <div className="space-y-2 p-3 bg-card border border-line rounded-lg">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(options.showQrCode)}
                        onChange={(e) => setOptions(o => ({ ...o, showQrCode: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-signal text-signal rounded cursor-pointer"
                      />
                      <span className="text-xs text-ink font-medium">Include QR Code</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(options.showItemName)}
                        onChange={(e) => setOptions(o => ({ ...o, showItemName: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-signal text-signal rounded cursor-pointer"
                      />
                      <span className="text-xs text-ink font-medium">Include Item Name</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(options.showCutLines)}
                        onChange={(e) => setOptions(o => ({ ...o, showCutLines: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-signal text-signal rounded cursor-pointer"
                      />
                      <span className="text-xs text-ink font-medium">Show Border / Cut Lines</span>
                    </label>
                  </div>
                </div>

                {/* Advanced Margins Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedMargins(!showAdvancedMargins)}
                    className="text-signal hover:underline text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>{showAdvancedMargins ? 'Hide Advanced Margins & Gaps' : 'Customize Margins & Spacing'}</span>
                  </button>

                  {showAdvancedMargins && (
                    <div className="mt-2 p-3 bg-card rounded-lg border border-line grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-slate block mb-0.5">Top Margin (mm)</label>
                        <input
                          type="number"
                          min="0"
                          max="40"
                          value={options.marginTopMm}
                          onChange={(e) => setOptions(o => ({ ...o, marginTopMm: e.target.value }))}
                          className="w-full px-2 py-1 bg-surface border border-line rounded font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-slate block mb-0.5">Left Margin (mm)</label>
                        <input
                          type="number"
                          min="0"
                          max="40"
                          value={options.marginLeftMm}
                          onChange={(e) => setOptions(o => ({ ...o, marginLeftMm: e.target.value }))}
                          className="w-full px-2 py-1 bg-surface border border-line rounded font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-slate block mb-0.5">Col Gap X (mm)</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={options.gapXMm}
                          onChange={(e) => setOptions(o => ({ ...o, gapXMm: e.target.value }))}
                          className="w-full px-2 py-1 bg-surface border border-line rounded font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-slate block mb-0.5">Row Gap Y (mm)</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={options.gapYMm}
                          onChange={(e) => setOptions(o => ({ ...o, gapYMm: e.target.value }))}
                          className="w-full px-2 py-1 bg-surface border border-line rounded font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Large Print Warning */}
                {isLargePrintJob && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-900 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-amber-900">Large Print Job Notice</div>
                        <div className="text-[11px] text-amber-800 leading-normal">
                          This will print <strong>{printData.totalLabels}</strong> labels over <strong>{totalPages}</strong> {options.layoutMode === 'roll' ? 'labels' : 'sheets'}.
                        </div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 pt-1 border-t border-amber-500/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmedLargePrint}
                        onChange={(e) => setConfirmedLargePrint(e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-amber-900">
                        I understand, proceed with this print job
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Right Visual Preview Area */}
              <div
                className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between bg-slate/5 overflow-hidden min-h-0"
                style={{ minHeight: 0 }}
              >
                {/* Preview Header & Controls */}
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-line shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">
                      {options.layoutMode === 'roll'
                        ? `Tag Preview (${safeCurrentPage + 1} of ${totalPages})`
                        : `Sheet Preview (${safeCurrentPage + 1} of ${totalPages})`}
                    </span>
                    <span className="text-[10px] text-slate px-2 py-0.5 bg-surface rounded border border-line font-mono">
                      {effectiveLabelWidth} × {effectiveLabelHeight} mm
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={safeCurrentPage === 0}
                      title="Previous page"
                      aria-label="Previous page"
                      icon={ChevronLeft}
                    />
                    <span className="text-xs font-mono text-slate tabular-nums px-1">
                      {safeCurrentPage + 1} / {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={safeCurrentPage >= totalPages - 1}
                      title="Next page"
                      aria-label="Next page"
                      icon={ChevronRight}
                    />
                  </div>
                </div>

                {/* Live Preview Paper */}
                <div
                  ref={previewContainerRef}
                  className="flex-1 flex items-center justify-center p-2 overflow-auto min-h-0"
                >
                  {options.layoutMode === 'roll' ? (
                    /* Roll Mode: Single Label Preview Mockup */
                    <div
                      style={{
                        width: `${effectiveLabelWidth * 3.779527 * rollScale}px`,
                        height: `${effectiveLabelHeight * 3.779527 * rollScale}px`,
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                      className="shadow-xl rounded border border-line mx-auto bg-white"
                    >
                      <div
                        style={{
                          width: `${effectiveLabelWidth}mm`,
                          height: `${effectiveLabelHeight}mm`,
                          transform: `scale(${rollScale})`,
                          transformOrigin: 'top left',
                          boxSizing: 'border-box'
                        }}
                        className="bg-white text-black"
                      >
                        <LabelCellContent
                          item={activePageItems[0] || itemsToPrint[0] || {}}
                          labelWidthMm={effectiveLabelWidth}
                          labelHeightMm={effectiveLabelHeight}
                          options={options}
                          isPrint={false}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Sheet Mode: Proportional Scaled A4 Sheet Mockup */
                    <div
                      style={{
                        width: `${targetSheetWidthPx}px`,
                        height: `${a4HeightPx * sheetScale}px`,
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                      className="shadow-xl rounded border border-line mx-auto bg-white"
                    >
                      <div
                        style={{
                          width: '210mm',
                          height: '297mm',
                          transform: `scale(${sheetScale})`,
                          transformOrigin: 'top left',
                          paddingTop: `${effectiveMargins.top}mm`,
                          paddingBottom: `${effectiveMargins.bottom}mm`,
                          paddingLeft: `${effectiveMargins.left}mm`,
                          paddingRight: `${effectiveMargins.right}mm`,
                          boxSizing: 'border-box'
                        }}
                        className="bg-white text-black"
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${sheetLayout.columns}, ${effectiveLabelWidth}mm)`,
                            gridTemplateRows: `repeat(${sheetLayout.rows}, ${effectiveLabelHeight}mm)`,
                            columnGap: `${effectiveMargins.gapX}mm`,
                            rowGap: `${effectiveMargins.gapY}mm`
                          }}
                        >
                          {activePageItems.map((item, idx) => (
                            <div
                              key={`sheet-cell-${idx}-${item.serial || 'empty'}`}
                              style={{
                                width: `${effectiveLabelWidth}mm`,
                                height: `${effectiveLabelHeight}mm`
                              }}
                            >
                              <LabelCellContent
                                item={item}
                                labelWidthMm={effectiveLabelWidth}
                                labelHeightMm={effectiveLabelHeight}
                                options={options}
                                isPrint={false}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status footer inside preview */}
                <div className="pt-2 text-[11px] text-slate flex items-center justify-between shrink-0">
                  <div>
                    {options.layoutMode === 'roll' ? (
                      <>Roll Mode: <span className="font-semibold text-ink">1</span> label per continuous page</>
                    ) : (
                      <>
                        Calculated: <span className="font-semibold text-ink">{sheetLayout.columns}</span> columns ×{' '}
                        <span className="font-semibold text-ink">{sheetLayout.rows}</span> rows ({sheetLayout.labelsPerPage} per sheet)
                      </>
                    )}
                  </div>
                  <div className="text-slate font-mono text-[10px]">
                    EDL Inventory Label Engine
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer - Fixed at bottom, flex: 0 0 auto */}
            <div
              className="p-3 sm:p-4 border-t border-line bg-surface/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0"
              style={{ flex: '0 0 auto' }}
            >
              <Button
                variant="secondary"
                size="regular"
                onClick={onClose}
                label="Cancel"
                className="w-full sm:w-auto"
              />

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <Button
                  variant="secondary"
                  size="regular"
                  onClick={handleDownloadPdf}
                  icon={FileDown}
                  label="Save as PDF"
                  title="Save as PDF via browser print dialog"
                />

                <Button
                  variant="primary"
                  size="regular"
                  onClick={handlePrint}
                  disabled={isLargePrintJob && !confirmedLargePrint}
                  icon={Printer}
                  label={`Print ${printData.totalLabels} Labels`}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dedicated Clean Print Portal (rendered directly onto body for window.print) */}
      {createPortal(
        <div id="print-serial-labels-portal" className="print-serial-labels-root">
          <style>{`
            @media print {
              @page {
                size: ${options.layoutMode === 'roll' ? `${effectiveLabelWidth}mm ${effectiveLabelHeight}mm` : 'A4 portrait'};
                margin: 0;
              }
              body.printing-serial-labels {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              body.printing-serial-labels #root,
              body.printing-serial-labels aside,
              body.printing-serial-labels header,
              body.printing-serial-labels nav,
              body.printing-serial-labels .no-print {
                display: none !important;
              }
              body.printing-serial-labels #print-serial-labels-portal {
                display: block !important;
                position: static !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
              }
              .print-sheet-page {
                width: ${options.layoutMode === 'roll' ? `${effectiveLabelWidth}mm` : '210mm'};
                height: ${options.layoutMode === 'roll' ? `${effectiveLabelHeight}mm` : '297mm'};
                max-height: ${options.layoutMode === 'roll' ? `${effectiveLabelHeight}mm` : '297mm'};
                page-break-after: always;
                break-after: page;
                box-sizing: border-box;
                position: relative;
                overflow: hidden;
                background: white;
              }
              .print-sheet-page:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }
              .print-label-cell {
                page-break-inside: avoid;
                break-inside: avoid;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                background: white;
              }
            }
          `}</style>

          {printData.pages.map((pageSlots, pageIdx) => (
            <div
              key={`print-sheet-${pageIdx}`}
              className="print-sheet-page"
              style={{
                paddingTop: options.layoutMode === 'roll' ? 0 : `${effectiveMargins.top}mm`,
                paddingBottom: options.layoutMode === 'roll' ? 0 : `${effectiveMargins.bottom}mm`,
                paddingLeft: options.layoutMode === 'roll' ? 0 : `${effectiveMargins.left}mm`,
                paddingRight: options.layoutMode === 'roll' ? 0 : `${effectiveMargins.right}mm`
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${sheetLayout.columns}, ${effectiveLabelWidth}mm)`,
                  gridTemplateRows: `repeat(${sheetLayout.rows}, ${effectiveLabelHeight}mm)`,
                  columnGap: `${effectiveMargins.gapX}mm`,
                  rowGap: `${effectiveMargins.gapY}mm`
                }}
              >
                {pageSlots.map((slot, sIdx) => (
                  <div
                    key={`print-cell-${sIdx}-${slot.serial || 'empty'}`}
                    className="print-label-cell"
                    style={{
                      width: `${effectiveLabelWidth}mm`,
                      height: `${effectiveLabelHeight}mm`
                    }}
                  >
                    <LabelCellContent
                      item={slot}
                      labelWidthMm={effectiveLabelWidth}
                      labelHeightMm={effectiveLabelHeight}
                      options={options}
                      isPrint={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

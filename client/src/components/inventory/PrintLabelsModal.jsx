import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
  }, [effectiveLabelWidth, effectiveLabelHeight, effectiveMargins]);

  // Build printable items chunked by page
  const printData = useMemo(() => {
    return buildPrintItems({
      items: itemsToPrint,
      copies: options.copies,
      startPosition: options.startPosition,
      layoutMode: 'sheet',
      labelsPerPage: sheetLayout.labelsPerPage
    });
  }, [itemsToPrint, options.copies, options.startPosition, sheetLayout.labelsPerPage]);

  const totalPages = printData.totalPages;
  const safeCurrentPage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const activePageItems = printData.pages[safeCurrentPage] || [];

  const isLargePrintJob = printData.totalLabels > 300;

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

  // Execute browser print
  const handlePrint = () => {
    if (isLargePrintJob && !confirmedLargePrint) {
      alert(`Notice: This print job will print ${printData.totalLabels} labels over ${totalPages} pages. Please check the confirmation box to proceed.`);
      return;
    }
    setIsPrinting(true);
    document.body.classList.add('printing-serial-labels');

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

  return (
    <>
      {/* Modal Dialog for Screen View */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto no-print"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-labels-modal-title"
      >
        <div className="bg-card w-full max-w-5xl rounded-2xl border border-line shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
          {/* Header */}
          <div className="p-4 border-b border-line flex items-center justify-between bg-surface/70 shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-signal/15 text-signal flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </span>
              <div>
                <h2 id="print-labels-modal-title" className="font-semibold text-ink text-sm sm:text-base">
                  Print Serial Labels
                </h2>
                <p className="text-[11px] text-slate">
                  <span className="font-semibold text-ink">{printData.totalLabels}</span> labels to print &bull;{' '}
                  <span className="font-semibold text-ink">{itemsToPrint.length}</span> unique serial numbers &bull;{' '}
                  <span className="font-semibold text-ink">{totalPages}</span> sheet(s)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate hover:text-ink hover:bg-surface transition-colors"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body: Left Controls, Right Preview */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line">
            {/* Left Controls Panel */}
            <div className="lg:col-span-5 p-4 sm:p-5 space-y-4 overflow-y-auto text-xs bg-surface/20">
              {/* Narrow Label Warning Banner */}
              {labelTooNarrowWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong>Label too narrow for this serial number:</strong> increase the label width or select a wider preset.
                  </div>
                </div>
              )}

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
                                {preset.defaultColumns} cols × {preset.defaultRows} rows = {preset.defaultColumns * preset.defaultRows} labels / sheet
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
              <div className="grid grid-cols-2 gap-3">
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
              </div>

              {/* Advanced Margins Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedMargins(!showAdvancedMargins)}
                  className="text-signal hover:underline text-[11px] font-medium flex items-center gap-1"
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
                        This will print <strong>{printData.totalLabels}</strong> labels over <strong>{totalPages}</strong> sheets.
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
            <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between bg-slate/5 overflow-hidden">
              {/* Preview Header & Controls */}
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-line shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink">
                    {`Sheet Preview (${safeCurrentPage + 1} of ${totalPages})`}
                  </span>
                  <span className="text-[10px] text-slate px-2 py-0.5 bg-surface rounded border border-line font-mono">
                    {effectiveLabelWidth} × {effectiveLabelHeight} mm
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={safeCurrentPage === 0}
                    className="p-1 rounded border border-line bg-card hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed text-ink"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-slate tabular-nums px-1">
                    {safeCurrentPage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={safeCurrentPage >= totalPages - 1}
                    className="p-1 rounded border border-line bg-card hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed text-ink"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Live Preview Paper */}
              <div
                ref={previewContainerRef}
                className="flex-1 flex items-center justify-center p-2 overflow-auto min-h-[340px]"
              >
                {/* Proportional Scaled A4 Sheet Mockup */}
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
              </div>

              {/* Status footer inside preview */}
              <div className="pt-2 text-[11px] text-slate flex items-center justify-between shrink-0">
                <div>
                  Calculated: <span className="font-semibold text-ink">{sheetLayout.columns}</span> columns ×{' '}
                  <span className="font-semibold text-ink">{sheetLayout.rows}</span> rows ({sheetLayout.labelsPerPage} per sheet)
                </div>
                <div className="text-slate font-mono text-[10px]">
                  EDL Inventory Label Engine
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="p-4 border-t border-line bg-surface/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-line bg-card hover:bg-surface text-xs font-medium text-slate hover:text-ink transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-3.5 py-2 rounded-lg border border-line bg-card hover:bg-surface text-ink text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Save as PDF via browser print dialog"
              >
                <FileDown className="w-4 h-4 text-slate" />
                <span>Save as PDF</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={isLargePrintJob && !confirmedLargePrint}
                className="px-5 py-2 rounded-lg bg-ink hover:bg-[#193254] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-subtle flex items-center gap-2"
              >
                <Printer className="w-4 h-4 text-signal" />
                <span>Print {printData.totalLabels} Labels</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Clean Print Portal (rendered directly onto body for window.print) */}
      {createPortal(
        <div id="print-serial-labels-portal" className="print-serial-labels-root">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
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
                width: 210mm;
                height: 297mm;
                max-height: 297mm;
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
                paddingTop: `${effectiveMargins.top}mm`,
                paddingBottom: `${effectiveMargins.bottom}mm`,
                paddingLeft: `${effectiveMargins.left}mm`,
                paddingRight: `${effectiveMargins.right}mm`
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

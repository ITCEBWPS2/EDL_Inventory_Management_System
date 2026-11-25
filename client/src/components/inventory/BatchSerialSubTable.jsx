import React, { useState } from 'react';
import { Eye, FileText, Check, Copy, Printer, X, Tag, ShieldCheck } from 'lucide-react';
import { IndeterminateCheckbox } from '../common/IndeterminateCheckbox';
import { Button } from '../common/Button';

export function getBatchSerialList(item) {
  if (Array.isArray(item?.serial_numbers) && item.serial_numbers.length > 0) {
    return item.serial_numbers;
  }
  const qty = Math.max(1, parseInt(item?.quantity, 10) || 1);
  const baseCode = (item?.item_code || 'ITM-001').trim();
  if (qty <= 1) return [baseCode];

  // Derive sequential serials from baseCode (e.g. ...-001 -> 001, 002, 003...)
  const match = baseCode.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const numDigits = Math.max(3, match[2].length);
    const startNum = parseInt(match[2], 10);
    const list = [];
    for (let i = 0; i < qty; i++) {
      list.push(`${prefix}${String(startNum + i).padStart(numDigits, '0')}`);
    }
    return list;
  }

  const list = [];
  for (let i = 1; i <= qty; i++) {
    list.push(`${baseCode}-${String(i).padStart(3, '0')}`);
  }
  return list;
}

export const BatchSerialSubTable = ({
  item,
  selectedSerials = null,
  onToggleSerial = null,
  onPrintSerial = null,
  onToggleAllBatchSerials = null
}) => {
  const [activeModal, setActiveModal] = useState(null); // { type: 'view' | 'document', serial: string, index: number }
  const [copiedSerial, setCopiedSerial] = useState(null);

  const serials = getBatchSerialList(item);

  const handleCopy = (serial) => {
    navigator.clipboard.writeText(serial);
    setCopiedSerial(serial);
    setTimeout(() => setCopiedSerial(null), 2000);
  };

  const handleTriggerPrint = (serial) => {
    if (!onPrintSerial) return;
    const targetSerial = typeof serial === 'string' ? serial : serial?.serial;
    onPrintSerial([{
      serial: targetSerial,
      itemName: item?.sub_classification || item?.item_name || '',
      itemId: item?.id
    }]);
  };

  const selectedCount = selectedSerials
    ? serials.filter(s => selectedSerials.has(s)).length
    : 0;
  const isAllSelected = selectedSerials && serials.length > 0 && selectedCount === serials.length;
  const isSomeSelected = selectedSerials && selectedCount > 0 && selectedCount < serials.length;

  return (
    <div className="py-2.5 px-3 bg-surface/60 rounded-lg border border-line/70">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-signal/10 text-signal text-[11px] font-bold">
            {serials.length}
          </span>
          <span className="text-xs font-semibold text-ink">
            Batch Units &amp; Individual Serial Numbers
          </span>
          {selectedSerials && selectedCount > 0 && (
            <span className="text-[11px] text-signal font-medium ml-2">
              ({selectedCount} of {serials.length} selected for printing)
            </span>
          )}
        </div>

        {onPrintSerial && (
          <Button
            size="small"
            variant="secondary"
            icon={Printer}
            onClick={() => {
              const itemsToPrint = serials.map(s => ({
                serial: s,
                itemName: item.sub_classification || item.item_name || '',
                itemId: item.id
              }));
              onPrintSerial(itemsToPrint);
            }}
            title="Print labels for all serial numbers in this batch"
            label={`Print All ${serials.length} Labels`}
          />
        )}
      </div>

      <div className="overflow-x-auto rounded border border-line bg-card shadow-sm">
        <table
          className="w-full text-left border-collapse text-xs"
          style={{
            tableLayout: 'fixed',
            minWidth: selectedSerials ? '860px' : '816px'
          }}
        >
          <colgroup>
            {selectedSerials && <col style={{ width: '44px', minWidth: '44px' }} />}
            <col style={{ width: '56px', minWidth: '56px' }} />
            <col style={{ width: '380px', minWidth: '320px' }} />
            <col style={{ width: '150px', minWidth: '150px' }} />
            <col style={{ width: '90px', minWidth: '90px' }} />
            <col style={{ width: '140px', minWidth: '140px' }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-line bg-white text-[11.5px] font-semibold text-slate uppercase tracking-[0.04em]">
              {selectedSerials && (
                <th
                  className="py-2.5 px-3 text-center shrink-0"
                  style={{
                    width: '44px',
                    minWidth: '44px',
                    backgroundColor: '#ffffff',
                    verticalAlign: 'bottom',
                    padding: '10px 12px'
                  }}
                >
                  <IndeterminateCheckbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={() => {
                      if (onToggleAllBatchSerials) {
                        onToggleAllBatchSerials(item);
                      }
                    }}
                    title={isAllSelected ? 'Deselect all batch serials' : 'Select all batch serials'}
                    aria-label="Select all batch serials"
                  />
                </th>
              )}
              <th
                className="py-2.5 px-3 text-left font-semibold text-slate uppercase"
                style={{
                  width: '56px',
                  minWidth: '56px',
                  backgroundColor: '#ffffff',
                  whiteSpace: 'normal',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  hyphens: 'none',
                  lineHeight: 1.25,
                  padding: '10px 12px',
                  verticalAlign: 'bottom',
                  fontSize: '11.5px',
                  letterSpacing: '0.04em'
                }}
              >
                No.
              </th>
              <th
                className="py-2.5 px-3 text-left font-semibold text-slate uppercase"
                style={{
                  width: '380px',
                  minWidth: '320px',
                  backgroundColor: '#ffffff',
                  whiteSpace: 'normal',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  hyphens: 'none',
                  lineHeight: 1.25,
                  padding: '10px 12px',
                  verticalAlign: 'bottom',
                  fontSize: '11.5px',
                  letterSpacing: '0.04em'
                }}
              >
                Serial No.
              </th>
              <th
                className="py-2.5 px-3 text-left font-semibold text-slate uppercase"
                style={{
                  width: '150px',
                  minWidth: '150px',
                  backgroundColor: '#ffffff',
                  whiteSpace: 'normal',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  hyphens: 'none',
                  lineHeight: 1.25,
                  padding: '10px 12px',
                  verticalAlign: 'bottom',
                  fontSize: '11.5px',
                  letterSpacing: '0.04em'
                }}
              >
                Manufacturer S/N
              </th>
              <th
                className="py-2.5 px-3 text-right font-semibold text-slate uppercase"
                style={{
                  width: '90px',
                  minWidth: '90px',
                  backgroundColor: '#ffffff',
                  whiteSpace: 'normal',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  hyphens: 'none',
                  lineHeight: 1.25,
                  padding: '10px 12px',
                  verticalAlign: 'bottom',
                  fontSize: '11.5px',
                  letterSpacing: '0.04em'
                }}
              >
                Quantity
              </th>
              <th
                className="py-2.5 px-3 text-right font-semibold text-slate uppercase"
                style={{
                  width: '140px',
                  minWidth: '140px',
                  backgroundColor: '#ffffff',
                  whiteSpace: 'normal',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  hyphens: 'none',
                  lineHeight: 1.25,
                  padding: '10px 12px',
                  verticalAlign: 'bottom',
                  fontSize: '11.5px',
                  letterSpacing: '0.04em'
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {serials.map((serial, idx) => {
              let mfgSerial = '';
              if (Array.isArray(item?.manufacturer_serial_numbers)) {
                mfgSerial = (item.manufacturer_serial_numbers[idx] || '').trim();
              } else if (idx === 0 && item?.serial_number) {
                // Legacy fallback for single records before batch mfg serial support
                mfgSerial = (item.serial_number || '').trim();
              }

              const isChecked = selectedSerials ? selectedSerials.has(serial) : false;

              return (
                <tr
                  key={serial || idx}
                  className={`hover:bg-surface/50 transition-colors ${
                    isChecked ? 'bg-signal/5' : ''
                  }`}
                >
                  {selectedSerials && (
                    <td className="py-2 px-3 text-center align-top shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (onToggleSerial) onToggleSerial(serial);
                        }}
                        aria-label={`Select serial ${serial}`}
                        className="w-4 h-4 rounded border-line text-signal accent-signal focus:ring-2 focus:ring-signal/30 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="py-2 px-3 font-mono text-slate text-xs font-medium align-top">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ink select-all whitespace-nowrap">
                        {serial}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(serial)}
                        title="Copy serial number"
                        aria-label={`Copy serial number ${serial}`}
                        className="w-[26px] h-[26px] rounded-[7px] text-slate hover:text-signal hover:bg-surface transition-colors inline-flex items-center justify-center shrink-0"
                      >
                        {copiedSerial === serial ? (
                          <Check className="w-3.5 h-3.5 text-signal" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-3 align-top">
                    {mfgSerial ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink select-all whitespace-nowrap">
                          {mfgSerial}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(mfgSerial)}
                          title="Copy manufacturer S/N"
                          aria-label={`Copy manufacturer S/N ${mfgSerial}`}
                          className="w-[26px] h-[26px] rounded-[7px] text-slate hover:text-signal hover:bg-surface transition-colors inline-flex items-center justify-center shrink-0"
                        >
                          {copiedSerial === mfgSerial ? (
                            <Check className="w-3.5 h-3.5 text-signal" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate font-normal select-none">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-ink tabular-nums align-top">
                    1
                  </td>
                  <td className="py-2 px-3 text-right align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      {onPrintSerial && (
                        <button
                          type="button"
                          onClick={() => handleTriggerPrint(serial)}
                          title="Print label for this serial"
                          aria-label={`Print label for ${serial}`}
                          className="w-[26px] h-[26px] rounded-[7px] inline-flex items-center justify-center hover:bg-surface text-slate hover:text-signal transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveModal({ type: 'view', serial, mfgSerial, index: idx + 1 })}
                        title="View Serial Unit Details"
                        aria-label={`View unit details for ${serial}`}
                        className="w-[26px] h-[26px] rounded-[7px] inline-flex items-center justify-center hover:bg-surface text-slate hover:text-signal transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveModal({ type: 'document', serial, mfgSerial, index: idx + 1 })}
                        title="Asset Tag & Verification Slip"
                        aria-label={`Asset Tag for ${serial}`}
                        className="w-[26px] h-[26px] rounded-[7px] inline-flex items-center justify-center hover:bg-surface text-slate hover:text-signal transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Unit Detail Modal */}
      {activeModal && activeModal.type === 'view' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150 no-print">
          <div className="bg-card w-full max-w-md rounded-xl border border-line shadow-dialog overflow-hidden">
            <div className="p-4 border-b border-line flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-signal/15 text-signal flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-ink text-sm">Individual Unit Details</h3>
                  <p className="text-[11px] text-slate">
                    Unit {activeModal.index} of {serials.length} in batch
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                icon={X}
                onClick={() => setActiveModal(null)}
                aria-label="Close details dialog"
              />
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-surface/70 rounded-lg border border-line space-y-2">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate tracking-wider mb-0.5">
                    Assigned Serial No.
                  </span>
                  <span className="font-mono text-sm font-semibold text-ink break-all select-all">
                    {activeModal.serial}
                  </span>
                </div>
                <div className="pt-2 border-t border-line/60 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate tracking-wider">
                    Manufacturer S/N
                  </span>
                  <span className="font-mono text-xs font-semibold text-ink">
                    {activeModal.mfgSerial || '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="block text-[11px] text-slate">Item Type / Model</span>
                  <span className="font-medium text-ink text-xs">
                    {item.sub_classification || item.item_name}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate">Category</span>
                  <span className="font-medium text-ink text-xs">
                    {item.category || 'Furniture'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate">Unit / Location</span>
                  <span className="font-medium text-ink text-xs">
                    {item.unit_name || 'ITO'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate">Unit Status</span>
                  <span className="inline-flex items-center gap-1 font-medium text-signal text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {item.status || 'In Stock'}
                  </span>
                </div>
                {item.brand && (
                  <div>
                    <span className="block text-[11px] text-slate">Brand</span>
                    <span className="font-medium text-ink text-xs">{item.brand}</span>
                  </div>
                )}
                <div>
                  <span className="block text-[11px] text-slate">Unit Quantity</span>
                  <span className="font-medium text-ink text-xs">1 unit</span>
                </div>
              </div>

              {item.description && (
                <div className="pt-2 border-t border-line">
                  <span className="block text-[11px] text-slate mb-1">Description / Remarks</span>
                  <p className="text-ink text-xs bg-surface p-2 rounded border border-line">
                    {item.description}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-line bg-surface/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  icon={Copy}
                  label="Copy Serial"
                  onClick={() => handleCopy(activeModal.serial)}
                />
                {onPrintSerial && (
                  <Button
                    size="small"
                    variant="secondary"
                    icon={Printer}
                    label="Print Label"
                    onClick={() => {
                      handleTriggerPrint(activeModal.serial);
                    }}
                  />
                )}
              </div>
              <Button
                size="small"
                variant="primary"
                label="Close"
                onClick={() => setActiveModal(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Asset Tag / Document Modal */}
      {activeModal && activeModal.type === 'document' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150 no-print">
          <div className="bg-card w-full max-w-md rounded-xl border border-line shadow-dialog overflow-hidden">
            <div className="p-4 border-b border-line flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-signal/15 text-signal flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-ink text-sm">Asset Verification Tag</h3>
                  <p className="text-[11px] text-slate">
                    Printable identification slip for physical tagging
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                icon={X}
                onClick={() => setActiveModal(null)}
                aria-label="Close asset tag dialog"
              />
            </div>

            <div className="p-6 text-center">
              {/* Asset Tag Card */}
              <div className="p-4 border-2 border-dashed border-line rounded-lg bg-surface/40 text-left font-mono">
                <div className="text-[10px] text-slate uppercase font-bold tracking-widest border-b border-line pb-1 mb-2 flex justify-between">
                  <span>Electricity Distribution Lanka</span>
                  <span>Unit {activeModal.index}/{serials.length}</span>
                </div>
                <div className="text-xs font-bold text-ink mb-1">
                  {item.sub_classification || item.item_name}
                </div>
                <div className="text-[11px] text-slate mb-3">
                  Location: <span className="text-ink font-semibold">{item.unit_name || 'ITO'}</span> &bull; Status: {item.status || 'In Stock'}
                </div>
                <div className="p-2.5 bg-card rounded border border-line text-center space-y-1.5">
                  <div>
                    <div className="text-[10px] uppercase text-slate tracking-wider mb-0.5">Serial Number</div>
                    <div className="text-xs font-bold text-ink tracking-tight break-all select-all">
                      {activeModal.serial}
                    </div>
                  </div>
                  {activeModal.mfgSerial && (
                    <div className="pt-1.5 border-t border-line/60">
                      <div className="text-[10px] uppercase text-slate tracking-wider mb-0.5">Manufacturer S/N</div>
                      <div className="text-xs font-semibold text-ink tracking-tight break-all select-all">
                        {activeModal.mfgSerial}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-line bg-surface/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  icon={Printer}
                  label="Print Slip"
                  onClick={() => {
                    window.print();
                  }}
                />
                {onPrintSerial && (
                  <Button
                    size="small"
                    variant="secondary"
                    icon={Tag}
                    label="Print Label"
                    onClick={() => {
                      handleTriggerPrint(activeModal.serial);
                    }}
                  />
                )}
              </div>
              <Button
                size="small"
                variant="primary"
                label="Done"
                onClick={() => setActiveModal(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

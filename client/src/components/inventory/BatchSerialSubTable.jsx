import React, { useState } from 'react';
import { Eye, FileText, Check, Copy, Printer, X, Tag, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function getBatchSerialList(item) {
  const qty = Math.max(1, parseInt(item?.quantity, 10) || 1);
  if (Array.isArray(item?.serial_numbers) && item.serial_numbers.length === qty) {
    return item.serial_numbers;
  }
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

export const BatchSerialSubTable = ({ item }) => {
  const [activeModal, setActiveModal] = useState(null); // { type: 'view' | 'document', serial: string, index: number }
  const [copiedSerial, setCopiedSerial] = useState(null);

  const serials = getBatchSerialList(item);

  const handleCopy = (serial) => {
    navigator.clipboard.writeText(serial);
    setCopiedSerial(serial);
    toast.success('Serial No. copied to clipboard');
    setTimeout(() => setCopiedSerial(null), 2000);
  };


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
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-line bg-card shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-line bg-surface/90 text-[11px] font-semibold text-slate uppercase tracking-wider">
              <th className="py-2 px-3 w-14">No.</th>
              <th className="py-2 px-3">Serial No.</th>
              <th className="py-2 px-3">Manufacturer S/N</th>
              <th className="py-2 px-3 text-right w-24">Quantity</th>
              <th className="py-2 px-3 text-right w-28">Actions</th>
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

              return (
                <tr key={serial || idx} className="hover:bg-surface/50 transition-colors">
                  <td className="py-2 px-3 font-mono text-slate text-xs font-medium">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ink select-all">
                        {serial}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(serial)}
                        title="Copy serial number"
                        className="p-1 rounded text-slate hover:text-signal hover:bg-surface transition-colors"
                      >
                        {copiedSerial === serial ? (
                          <Check className="w-3.5 h-3.5 text-signal" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    {mfgSerial ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink select-all">
                          {mfgSerial}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(mfgSerial)}
                          title="Copy manufacturer S/N"
                          className="p-1 rounded text-slate hover:text-signal hover:bg-surface transition-colors"
                        >
                          {copiedSerial === mfgSerial ? (
                            <Check className="w-3.5 h-3.5 text-signal" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate font-normal">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-ink tabular-nums">
                    1
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveModal({ type: 'view', serial, mfgSerial, index: idx + 1 })}
                        title="View Serial Unit Details"
                        className="p-1.5 rounded hover:bg-surface text-slate hover:text-signal transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveModal({ type: 'document', serial, mfgSerial, index: idx + 1 })}
                        title="Asset Tag &amp; Verification Slip"
                        className="p-1.5 rounded hover:bg-surface text-slate hover:text-signal transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150">
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
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded text-slate hover:text-ink hover:bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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
              <button
                type="button"
                onClick={() => handleCopy(activeModal.serial)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-line bg-card hover:bg-surface text-xs font-medium text-ink transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Serial No.</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded bg-ink text-surface text-xs font-medium hover:bg-slate transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Tag / Document Modal */}
      {activeModal && activeModal.type === 'document' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150">
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
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded text-slate hover:text-ink hover:bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-line bg-card hover:bg-surface text-xs font-medium text-ink transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Tag</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded bg-ink text-surface text-xs font-medium hover:bg-slate transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

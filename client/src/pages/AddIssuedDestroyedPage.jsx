import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ChevronDown, Check, AlertCircle, ExternalLink, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DateInput } from '../components/common/DateInput';
import { Button } from '../components/common/Button';

export const AddIssuedDestroyedPage = () => {
  const { user, selectedUnitId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const activeUnitId = selectedUnitId || user?.units?.[0]?.id || '11111111-1111-1111-1111-111111111145';

  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // Multi-select serials state
  const [selectedSerials, setSelectedSerials] = useState([]);
  const [serialSearch, setSerialSearch] = useState('');

  // Form fields
  const [quantity, setQuantity] = useState(1);
  const [disposition, setDisposition] = useState('Issued');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  // Item dropdown filter
  const [itemSearch, setItemSearch] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Load candidate items marked as Issued or Destroyed in New Verification
  useEffect(() => {
    let isMounted = true;
    setLoadingCandidates(true);
    api.get('/verifications/issued-destroyed-candidates', { unit_id: activeUnitId })
      .then(res => {
        if (isMounted && res.success) {
          const list = res.data || [];
          setCandidates(list);
        }
      })
      .catch(err => {
        if (isMounted) toast.error('Failed to load candidate items for this unit.');
      })
      .finally(() => {
        if (isMounted) setLoadingCandidates(false);
      });

    return () => { isMounted = false; };
  }, [activeUnitId]);

  const handleSelectCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    setItemSearch('');
    setSearchDropdownOpen(false);

    // Pre-fill and lock disposition
    setDisposition(candidate.disposition || 'Issued');

    // Pre-fill date from verification or today
    setDate(candidate.verification_date || new Date().toISOString().split('T')[0]);

    // Reset selected serials
    setSelectedSerials([]);
    setSerialSearch('');

    // If item doesn't have individual serial numbers, set quantity default to min(1, remaining)
    setQuantity(Math.min(1, candidate.remaining_quantity || 1));

    setErrors(prev => ({ ...prev, item: null, quantity: null, serials: null }));
  };

  const handleClearCandidate = () => {
    setSelectedCandidate(null);
    setSelectedSerials([]);
    setSerialSearch('');
    setQuantity(1);
    setReason('');
    setErrors({});
  };

  const candidateSerials = useMemo(() => {
    if (!selectedCandidate || !Array.isArray(selectedCandidate.serial_numbers)) return [];
    return selectedCandidate.serial_numbers;
  }, [selectedCandidate]);

  const hasIndividualSerials = candidateSerials.length > 0;

  // Filtered serials based on serialSearch query
  const filteredSerials = useMemo(() => {
    if (!serialSearch.trim()) return candidateSerials;
    const q = serialSearch.toLowerCase().trim();
    return candidateSerials.filter(s => (s.serial_number || '').toLowerCase().includes(q));
  }, [candidateSerials, serialSearch]);

  const maxAllowed = selectedCandidate ? Number(selectedCandidate.remaining_quantity || 1) : 1;

  // Toggle single serial selection
  const handleToggleSerial = (serialNumber, isRecorded) => {
    if (isRecorded) return;
    setSelectedSerials(prev => {
      if (prev.includes(serialNumber)) {
        return prev.filter(s => s !== serialNumber);
      } else {
        if (prev.length >= maxAllowed) {
          toast.warning(`Cannot select more than ${maxAllowed} serial numbers (remaining required quantity).`);
          return prev;
        }
        return [...prev, serialNumber];
      }
    });
    if (errors.serials) {
      setErrors(prev => ({ ...prev, serials: null }));
    }
  };

  // "Select all remaining" action
  const handleSelectAllRemaining = () => {
    if (!selectedCandidate) return;
    const availableUnrecorded = candidateSerials
      .filter(s => !s.is_recorded)
      .map(s => s.serial_number);

    const toSelect = availableUnrecorded.slice(0, maxAllowed);
    setSelectedSerials(toSelect);
    if (errors.serials) {
      setErrors(prev => ({ ...prev, serials: null }));
    }
  };

  // "Clear" selection action
  const handleClearSerials = () => {
    setSelectedSerials([]);
  };

  // Keep quantity in sync with selected serials for serialised items
  useEffect(() => {
    if (hasIndividualSerials) {
      setQuantity(selectedSerials.length);
    }
  }, [hasIndividualSerials, selectedSerials]);

  const filteredCandidates = useMemo(() => {
    if (!itemSearch.trim()) return candidates;
    const q = itemSearch.toLowerCase().trim();
    return candidates.filter(c =>
      (c.item_name && c.item_name.toLowerCase().includes(q)) ||
      (c.item_code && c.item_code.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q))
    );
  }, [candidates, itemSearch]);

  const validate = () => {
    const errs = {};
    if (!selectedCandidate) {
      errs.item = 'Please select an item from the candidate list.';
    }

    if (hasIndividualSerials) {
      if (selectedSerials.length === 0) {
        errs.serials = 'Please select at least one serial number.';
      } else if (selectedSerials.length > maxAllowed) {
        errs.serials = `You cannot select more than ${maxAllowed} serials.`;
      }
    } else {
      const numQty = Number(quantity);
      if (!numQty || isNaN(numQty) || numQty < 1) {
        errs.quantity = 'Quantity must be at least 1.';
      } else if (numQty > maxAllowed) {
        errs.quantity = `Quantity cannot exceed remaining required (${maxAllowed}).`;
      }
    }

    if (!disposition) {
      errs.disposition = 'Disposition is required.';
    }
    if (!date) {
      errs.date = 'Date is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        unit_id: activeUnitId,
        item_id: selectedCandidate.inventory_item_id || selectedCandidate.item_id,
        serial_numbers: hasIndividualSerials ? selectedSerials : [],
        serial_number: hasIndividualSerials && selectedSerials.length > 0 ? selectedSerials[0] : (selectedCandidate.item_code || null),
        quantity: hasIndividualSerials ? selectedSerials.length : Number(quantity),
        disposition: selectedCandidate.disposition,
        reason: reason.trim(),
        date,
        verification_id: selectedCandidate.verification_id || null
      };

      const res = await api.post('/verifications/issued-destroyed', payload);
      if (res.success) {
        toast.success('Issued / Destroyed record saved.');
        navigate('/verification/issued-destroyed');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to record issued / destroyed item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/annual-verification' },
        { label: 'Issued / Destroyed Items', path: '/verification/issued-destroyed' },
        { label: 'Add' }
      ]}
    >
      <div className="py-4">
        {/* Centered Form Card (~580px) */}
        <div className="max-w-[580px] mx-auto bg-card rounded-xl border border-line shadow-card p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-ink tracking-tight">
              Add Issued / Destroyed Item
            </h1>
            <p className="text-xs text-slate mt-1 leading-relaxed">
              Record inventory items marked as <strong>Issued</strong> or <strong>Destroyed</strong> in Annual Verification.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {/* 1. Pick Inventory Item from Candidates */}
            <div>
              <label className="block font-medium text-ink mb-1.5">
                Pick Inventory Item <span className="text-[#B4483A]">*</span>
              </label>

              {!selectedCandidate ? (
                <div className="relative">
                  <div
                    onClick={() => setSearchDropdownOpen(prev => !prev)}
                    className={`w-full px-3 py-2.5 bg-surface border rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                      errors.item ? 'border-[#B4483A]' : 'border-line hover:border-slate/40'
                    }`}
                  >
                    <span className="text-slate truncate">
                      {loadingCandidates
                        ? 'Loading candidate items from New Verification...'
                        : candidates.length === 0
                        ? 'No marked items pending record.'
                        : 'Choose an item marked Issued/Destroyed in New Verification...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate shrink-0 ml-2" />
                  </div>

                  {searchDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-card rounded-lg border border-line shadow-modal max-h-72 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-line bg-surface/50">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search candidate by name, code or category..."
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-card border border-line rounded text-xs text-ink placeholder:text-slate/60 focus:outline-none focus:border-signal"
                          />
                        </div>
                      </div>

                      <div className="overflow-y-auto flex-1 divide-y divide-line/40">
                        {loadingCandidates ? (
                          <div className="p-4 text-center text-slate">Loading candidates...</div>
                        ) : candidates.length === 0 ? (
                          <div className="p-5 text-center text-slate space-y-2">
                            <p className="text-xs">
                              No items have been marked as Issued / Destroyed in New Verification yet.
                            </p>
                            <Link
                              to="/verification/new"
                              className="inline-flex items-center gap-1 text-xs text-signal hover:underline font-semibold"
                            >
                              <span>Go to New Verification</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        ) : filteredCandidates.length === 0 ? (
                          <div className="p-4 text-center text-slate">No matching candidate items found.</div>
                        ) : (
                          filteredCandidates.map(c => {
                            const isIssued = c.disposition === 'Issued';
                            return (
                              <div
                                key={`${c.item_id}-${c.disposition}`}
                                onClick={() => handleSelectCandidate(c)}
                                className="p-3 hover:bg-surface cursor-pointer transition-colors flex items-center justify-between gap-2.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-ink truncate">{c.item_name}</div>
                                  <div className="text-[11px] font-mono text-slate truncate mt-0.5">
                                    {c.item_code} <span className="font-sans text-slate/70">({c.category})</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                      isIssued
                                        ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50'
                                        : 'border-rose-500/40 text-rose-700 bg-rose-50'
                                    }`}
                                  >
                                    {c.disposition}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-surface border border-line text-[10px] font-bold text-slate">
                                    Pending: {c.remaining_quantity}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {errors.item && (
                    <p className="mt-1 text-[11px] text-[#B4483A] flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{errors.item}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-surface/80 border border-line rounded-lg px-3.5 py-2.5 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{selectedCandidate.item_name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          selectedCandidate.disposition === 'Issued'
                            ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50'
                            : 'border-rose-500/40 text-rose-700 bg-rose-50'
                        }`}
                      >
                        {selectedCandidate.disposition}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate font-mono mt-0.5">
                      {selectedCandidate.item_code} • Pending to record: <strong className="text-ink font-bold">{selectedCandidate.remaining_quantity}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearCandidate}
                    className="text-[11px] text-signal hover:underline font-semibold shrink-0 ml-3"
                  >
                    Change Item
                  </button>
                </div>
              )}
            </div>

            {/* 2. Item Name & Serial No. (Locked) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Item Name */}
              <div>
                <label className="block font-medium text-ink mb-1.5">Item Name</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedCandidate ? selectedCandidate.item_name : ''}
                  placeholder="Auto-filled from verification mark"
                  className="w-full px-3 py-2 bg-surface text-slate border border-line rounded-lg text-xs font-medium cursor-not-allowed"
                />
              </div>

              {/* Serial No. (Summary) */}
              <div>
                <label className="block font-medium text-ink mb-1.5">Serial No.</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={
                    hasIndividualSerials
                      ? selectedSerials.length > 0
                        ? `${selectedSerials.length} serials selected`
                        : `${candidateSerials.length} serials available`
                      : selectedCandidate ? (selectedCandidate.item_code || '—') : ''
                  }
                  placeholder="Auto-filled from selected serials"
                  className="w-full px-3 py-2 bg-surface text-slate border border-line rounded-lg font-mono text-xs cursor-not-allowed"
                />
              </div>
            </div>

            {/* 3. Multi-Select Serial Numbers (for items with individual serials) */}
            {selectedCandidate && hasIndividualSerials && (
              <div className="border border-line rounded-xl bg-surface/30 p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-2">
                  <div className="font-semibold text-ink flex items-center gap-2">
                    <span>Select Serial Numbers</span>
                    <span className="text-[11px] font-normal text-slate">
                      (Selected <strong className="text-ink font-bold">{selectedSerials.length}</strong> of{' '}
                      <strong className="text-ink font-bold">{maxAllowed}</strong> required)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllRemaining}
                      className="text-signal hover:underline font-semibold cursor-pointer"
                    >
                      Select all remaining
                    </button>
                    <span className="text-slate/40">•</span>
                    <button
                      type="button"
                      onClick={handleClearSerials}
                      className="text-slate hover:text-ink hover:underline font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Serial Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" />
                  <input
                    type="text"
                    placeholder="Search serial numbers..."
                    value={serialSearch}
                    onChange={(e) => setSerialSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-card border border-line rounded-lg text-xs font-mono text-ink placeholder:text-slate/60 focus:outline-none focus:border-signal"
                  />
                  {serialSearch && (
                    <button
                      type="button"
                      onClick={() => setSerialSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate hover:text-ink p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Scrollable list of serials */}
                <div className="max-h-52 overflow-y-auto border border-line rounded-lg bg-card divide-y divide-line/40">
                  {filteredSerials.length === 0 ? (
                    <div className="p-3 text-center text-slate">No matching serials found.</div>
                  ) : (
                    filteredSerials.map((snObj, sIdx) => {
                      const sn = snObj.serial_number;
                      const isRecorded = Boolean(snObj.is_recorded);
                      const isChecked = selectedSerials.includes(sn);
                      const isMaxReached = !isChecked && selectedSerials.length >= maxAllowed;
                      const isDisabled = isRecorded || isMaxReached;

                      return (
                        <label
                          key={`${sn}-${sIdx}`}
                          className={`flex items-center justify-between px-3 py-2 text-xs select-none transition-colors ${
                            isRecorded
                              ? 'bg-surface/50 opacity-60 cursor-not-allowed'
                              : isMaxReached
                              ? 'opacity-60 cursor-not-allowed hover:bg-surface/30'
                              : 'hover:bg-surface cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={() => handleToggleSerial(sn, isRecorded)}
                              className="w-4 h-4 rounded border-line text-signal focus:ring-signal focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span className="font-mono font-medium text-ink truncate whitespace-nowrap" title={sn}>
                              {sn}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {isRecorded ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface border border-line text-slate">
                                Recorded
                              </span>
                            ) : isChecked ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 border border-emerald-300 text-emerald-700 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Selected
                              </span>
                            ) : null}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                {errors.serials && (
                  <p className="text-[11px] text-[#B4483A] font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{errors.serials}</span>
                  </p>
                )}
              </div>
            )}

            {/* 4. Row: Qty, Disposition (Locked), Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Qty */}
              <div>
                <label className="block font-medium text-ink mb-1.5">
                  Qty <span className="text-[#B4483A]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxAllowed}
                  readOnly={hasIndividualSerials}
                  disabled={hasIndividualSerials}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-xs tabular-nums font-bold ${
                    hasIndividualSerials
                      ? 'bg-surface text-slate cursor-not-allowed border-line'
                      : errors.quantity
                      ? 'bg-card border-[#B4483A] text-ink'
                      : 'bg-card border-line text-ink focus:outline-none focus:border-signal'
                  }`}
                />
                {errors.quantity && (
                  <p className="mt-1 text-[11px] text-[#B4483A] leading-tight">{errors.quantity}</p>
                )}
                {hasIndividualSerials && (
                  <span className="text-[10px] text-slate mt-1 block">
                    Calculated automatically
                  </span>
                )}
              </div>

              {/* Disposition (Locked / Read-only) */}
              <div>
                <label className="block font-medium text-ink mb-1.5">
                  Disposition <span className="text-[#B4483A]">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={disposition}
                  title="Disposition is determined by New Verification"
                  className="w-full px-3 py-2 bg-surface text-slate border border-line rounded-lg text-xs font-semibold cursor-not-allowed"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block font-medium text-ink mb-1.5">
                  Date <span className="text-[#B4483A]">*</span>
                </label>
                <DateInput
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  error={errors.date}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>

            {/* 5. Reason */}
            <div>
              <label className="block font-medium text-ink mb-1.5">
                Reason <span className="text-slate font-normal">(optional)</span>
              </label>
              <textarea
                rows="3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Brief reason for issuance or disposal..."
                className="w-full px-3 py-2 bg-card border border-line rounded-lg text-xs text-ink placeholder:text-slate/60 focus:outline-none focus:border-signal leading-relaxed"
              />
            </div>

            {/* Action Buttons: Cancel (left) & Save (right) */}
            <div className="pt-4 border-t border-line flex items-center justify-between gap-3">
              <Button
                to="/verification/issued-destroyed"
                id="btn-cancel-add"
                variant="secondary"
                size="regular"
                label="Cancel"
              />

              <Button
                type="submit"
                id="btn-save-issued-destroyed"
                variant="primary"
                size="regular"
                loading={submitting}
                label="Save"
              />
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
};

export default AddIssuedDestroyedPage;

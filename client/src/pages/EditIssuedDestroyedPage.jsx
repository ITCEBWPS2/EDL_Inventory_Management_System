import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Search, AlertCircle, ArrowLeft, Check, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DateInput } from '../components/common/DateInput';

export const EditIssuedDestroyedPage = () => {
  const { id } = useParams();
  const { selectedUnitId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [record, setRecord] = useState(null);

  const [itemDetails, setItemDetails] = useState(null);
  const [otherRecords, setOtherRecords] = useState([]);

  // Multi-select serials state
  const [selectedSerials, setSelectedSerials] = useState([]);
  const [serialSearch, setSerialSearch] = useState('');

  // Form fields
  const [quantity, setQuantity] = useState(1);
  const [disposition, setDisposition] = useState('Issued');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  // Validation errors
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.get(`/verifications/issued-destroyed/${id}`),
      api.get('/verifications/issued-destroyed', { unit_id: selectedUnitId })
    ])
      .then(async ([recRes, allRecRes]) => {
        if (!isMounted) return;
        if (!recRes.success || !recRes.data) {
          setNotFound(true);
          return;
        }

        const recData = recRes.data;
        setRecord(recData);

        // Serials already saved on this record
        const savedSerials = Array.isArray(recData.serial_numbers) && recData.serial_numbers.length > 0
          ? recData.serial_numbers
          : (recData.serial_number ? [recData.serial_number] : []);
        setSelectedSerials(savedSerials);

        setQuantity(recData.quantity || (savedSerials.length > 0 ? savedSerials.length : 1));
        setDisposition(recData.disposition || 'Issued');
        setDate(recData.date || new Date().toISOString().split('T')[0]);
        setReason(recData.reason || '');

        // Other records for this unit to check which serials are locked elsewhere
        const otherList = (allRecRes?.data || []).filter(r => r.id !== id);
        setOtherRecords(otherList);

        // Load inventory item to know full serials list
        if (recData.item_id) {
          try {
            const itemRes = await api.get(`/inventory/${recData.item_id}`).catch(() => null);
            if (isMounted && itemRes?.success && itemRes?.data) {
              setItemDetails(itemRes.data);
            }
          } catch (e) {
            console.error('Failed to load inventory item details:', e);
          }
        }
      })
      .catch(err => {
        if (isMounted) {
          setNotFound(true);
          toast.error(err.message || 'Failed to load record.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [id, selectedUnitId]);

  // Set of serial numbers recorded in OTHER records
  const serialsRecordedInOtherRecords = useMemo(() => {
    const set = new Set();
    otherRecords.forEach(r => {
      if (r.item_id === record?.item_id) {
        if (Array.isArray(r.serial_numbers)) {
          r.serial_numbers.forEach(s => s && set.add(s));
        }
        if (r.serial_number) set.add(r.serial_number);
      }
    });
    return set;
  }, [otherRecords, record]);

  // Candidate serials for this item
  const itemSerialsList = useMemo(() => {
    const rawList = Array.isArray(itemDetails?.serial_numbers) && itemDetails.serial_numbers.length > 0
      ? itemDetails.serial_numbers
      : (Array.isArray(record?.serial_numbers) && record.serial_numbers.length > 0
        ? record.serial_numbers
        : (itemDetails?.item_code ? [itemDetails.item_code] : (record?.serial_number ? [record.serial_number] : [])));

    return rawList.map(sn => ({
      serial_number: sn,
      is_recorded_elsewhere: serialsRecordedInOtherRecords.has(sn)
    }));
  }, [itemDetails, record, serialsRecordedInOtherRecords]);

  const hasIndividualSerials = itemSerialsList.length > 0;

  // Filtered serials based on serialSearch query
  const filteredSerials = useMemo(() => {
    if (!serialSearch.trim()) return itemSerialsList;
    const q = serialSearch.toLowerCase().trim();
    return itemSerialsList.filter(s => (s.serial_number || '').toLowerCase().includes(q));
  }, [itemSerialsList, serialSearch]);

  const handleToggleSerial = (sn, isRecordedElsewhere) => {
    if (isRecordedElsewhere) return;
    setSelectedSerials(prev => {
      if (prev.includes(sn)) {
        return prev.filter(s => s !== sn);
      } else {
        return [...prev, sn];
      }
    });
    if (errors.serials) {
      setErrors(prev => ({ ...prev, serials: null }));
    }
  };

  const handleSelectAllAvailable = () => {
    const available = itemSerialsList
      .filter(s => !s.is_recorded_elsewhere)
      .map(s => s.serial_number);
    setSelectedSerials(available);
    if (errors.serials) {
      setErrors(prev => ({ ...prev, serials: null }));
    }
  };

  const handleClearSerials = () => {
    setSelectedSerials([]);
  };

  // Sync quantity with selected serials for serialised items
  useEffect(() => {
    if (hasIndividualSerials) {
      setQuantity(selectedSerials.length);
    }
  }, [hasIndividualSerials, selectedSerials]);

  const validate = () => {
    const errs = {};
    if (hasIndividualSerials) {
      if (selectedSerials.length === 0) {
        errs.serials = 'Please select at least one serial number.';
      }
    } else {
      const numQty = Number(quantity);
      if (!numQty || isNaN(numQty) || numQty < 1) {
        errs.quantity = 'Quantity must be at least 1.';
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
        item_id: record.item_id,
        serial_numbers: hasIndividualSerials ? selectedSerials : [],
        serial_number: hasIndividualSerials && selectedSerials.length > 0 ? selectedSerials[0] : (record.serial_number || null),
        quantity: hasIndividualSerials ? selectedSerials.length : Number(quantity),
        disposition,
        reason: reason.trim(),
        date,
        verification_id: record.verification_id || null
      };

      const res = await api.put(`/verifications/issued-destroyed/${id}`, payload);
      if (res.success) {
        toast.success('Record updated successfully.');
        navigate('/verification/issued-destroyed');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/annual-verification' },
        { label: 'Issued / Destroyed Items', path: '/verification/issued-destroyed' },
        { label: 'Edit' }
      ]}
    >
      <div className="py-4">
        {loading ? (
          <div className="max-w-[580px] mx-auto bg-card rounded-xl border border-line shadow-card p-12 text-center text-slate">
            <div className="inline-block w-6 h-6 border-2 border-slate/30 border-t-ink rounded-full animate-spin mb-3"></div>
            <div>Loading record details...</div>
          </div>
        ) : notFound ? (
          <div className="max-w-[580px] mx-auto bg-card rounded-xl border border-line shadow-card p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#B4483A]/10 text-[#B4483A] flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-base font-semibold text-ink">Record Not Found</h2>
            <p className="text-xs text-slate mt-2 leading-relaxed">
              This issued / destroyed record could not be found or belongs to another organizational unit.
            </p>
            <Link
              to="/verification/issued-destroyed"
              className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-ink hover:bg-[#193254] text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Issued / Destroyed List</span>
            </Link>
          </div>
        ) : (
          /* Centered Form Card (~580px) */
          <div className="max-w-[580px] mx-auto bg-card rounded-xl border border-line shadow-card p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-lg font-semibold text-ink tracking-tight">
                Edit Issued / Destroyed Record
              </h1>
              <p className="text-xs text-slate mt-1 leading-relaxed">
                Update details or selected serial numbers for this issued / destroyed record.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* Linked Item Display */}
              <div>
                <label className="block font-medium text-ink mb-1.5">
                  Linked Inventory Item
                </label>
                <div className="bg-surface/80 border border-line rounded-lg px-3.5 py-2.5 text-xs">
                  <div className="font-semibold text-ink">
                    {record.item_name || itemDetails?.item_name || 'Inventory Item'}
                  </div>
                  <div className="text-[11px] text-slate font-mono mt-0.5">
                    {record.item_code || itemDetails?.item_code || '—'}
                  </div>
                </div>
              </div>

              {/* Item Name & Serial No. Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-ink mb-1.5">Item Name</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={record.item_name || itemDetails?.item_name || ''}
                    className="w-full px-3 py-2 bg-surface text-slate border border-line rounded-lg text-xs font-medium cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink mb-1.5">Serial No.</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={
                      hasIndividualSerials
                        ? `${selectedSerials.length} serials selected`
                        : (record.serial_number || record.item_code || '—')
                    }
                    className="w-full px-3 py-2 bg-surface text-slate border border-line rounded-lg font-mono text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Multi-Select Serial Numbers */}
              {hasIndividualSerials && (
                <div className="border border-line rounded-xl bg-surface/30 p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-2">
                    <div className="font-semibold text-ink flex items-center gap-2">
                      <span>Select Serial Numbers</span>
                      <span className="text-[11px] font-normal text-slate">
                        (Selected <strong className="text-ink font-bold">{selectedSerials.length}</strong> serials)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={handleSelectAllAvailable}
                        className="text-signal hover:underline font-semibold cursor-pointer"
                      >
                        Select all available
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
                        const isRecordedElsewhere = Boolean(snObj.is_recorded_elsewhere);
                        const isChecked = selectedSerials.includes(sn);

                        return (
                          <label
                            key={`${sn}-${sIdx}`}
                            className={`flex items-center justify-between px-3 py-2 text-xs select-none transition-colors ${
                              isRecordedElsewhere
                                ? 'bg-surface/50 opacity-60 cursor-not-allowed'
                                : 'hover:bg-surface cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isRecordedElsewhere}
                                onChange={() => handleToggleSerial(sn, isRecordedElsewhere)}
                                className="w-4 h-4 rounded border-line text-signal focus:ring-signal focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span className="font-mono font-medium text-ink truncate whitespace-nowrap" title={sn}>
                                {sn}
                              </span>
                            </div>

                            <div className="shrink-0">
                              {isRecordedElsewhere ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface border border-line text-slate">
                                  Recorded Elsewhere
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

              {/* Qty, Disposition (Locked), Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Qty */}
                <div>
                  <label className="block font-medium text-ink mb-1.5">
                    Qty <span className="text-[#B4483A]">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
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

                {/* Disposition (Locked) */}
                <div>
                  <label className="block font-medium text-ink mb-1.5">
                    Disposition <span className="text-[#B4483A]">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={disposition}
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

              {/* Reason */}
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
                <Link
                  to="/verification/issued-destroyed"
                  id="btn-cancel-edit"
                  className="px-4 py-2 text-xs font-medium text-slate hover:text-ink bg-card hover:bg-surface border border-line rounded-lg transition-colors"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  id="btn-update-issued-destroyed"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-ink hover:bg-[#193254] rounded-lg transition-colors shadow-subtle flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default EditIssuedDestroyedPage;

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { BackButton } from '../components/common/BackButton';
import { ConfirmModal } from '../components/common/ConfirmModal';
import {
  MapPin,
  ClipboardCheck,
  Printer,
  Save,
  ChevronRight,
  X,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Trash2,
  RotateCcw
} from 'lucide-react';

const CONDITION_OPTIONS = ['—', 'Good', 'Fair', 'Damaged', 'Obsolete', 'Needs Repair'];

export const NewVerification = () => {
  const { user, selectedUnitId, selectedUnit } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  // Step 1: Entry Form | Step 2: Review & Confirm
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isExistingConfirmed, setIsExistingConfirmed] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [verifier1, setVerifier1] = useState('');
  const [verifier2, setVerifier2] = useState('');
  const [verifier3, setVerifier3] = useState('');

  // Table items
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});

  // Item removal confirmation dialog state
  const [itemToRemove, setItemToRemove] = useState(null);

  // Auto-sync year when date changes
  const handleDateChange = (e) => {
    const val = e.target.value;
    setDate(val);
    if (val) {
      const parsedYear = new Date(val).getFullYear();
      if (!isNaN(parsedYear)) {
        setYear(parsedYear);
      }
    }
    if (errors.date) {
      setErrors(prev => ({ ...prev, date: null }));
    }
  };

  // Location display string
  const locationDisplay = selectedUnit?.unit_name
    ? `${selectedUnit.unit_name}${selectedUnit.unit_code ? ` (${selectedUnit.unit_code})` : ''}`
    : 'All Units (CSC_HOMAGAMA)';

  // Load items or existing verification record
  const loadInitialData = async () => {
    setLoading(true);
    setErrors({});
    try {
      if (editId) {
        // Loading existing verification (e.g. view from history or edit)
        const res = await api.get(`/verifications/${editId}`);
        if (res.success && res.data) {
          const v = res.data;
          setDate(v.date || new Date().toISOString().split('T')[0]);
          setYear(v.year || new Date().getFullYear());

          const vList = [v.verifier_1, v.verifier_2, v.verifier_3].filter(Boolean);
          if (vList.length === 0 && Array.isArray(v.verified_by)) {
            vList.push(...v.verified_by);
          }
          setVerifier1(v.verifier_1 || vList[0] || '');
          setVerifier2(v.verifier_2 || vList[1] || '');
          setVerifier3(v.verifier_3 || vList[2] || '');

          const loadedItems = (v.items || []).map(item => ({
            id: item.id,
            item_code: item.item_code || '',
            item_name: item.item_name || '',
            category: item.category || 'General',
            system_qty: Number(item.system_qty || 0),
            physical_qty: item.physical_qty !== null && item.physical_qty !== undefined ? item.physical_qty : '',
            difference: item.difference !== undefined ? item.difference : null,
            condition: item.condition || '—',
            label_no: item.label_no || '',
            remarks: item.remarks || '',
            status: item.status || 'Not Counted'
          }));
          setItems(loadedItems);

          if (v.status === 'confirmed') {
            setIsExistingConfirmed(true);
            setCurrentStep(2); // Jump directly to Review & Confirm screen
          }
        }
      } else {
        // New verification: fetch remaining items for active unit
        const unitRes = await api.get('/transactions/remaining', { unit_id: selectedUnitId });
        if (unitRes.success && Array.isArray(unitRes.data)) {
          const initialItems = unitRes.data.map(r => {
            const rawCode = (r.item_code || r.item_name || 'ITEM').replace(/[^a-zA-Z0-9]/g, '');
            const codeSuffix = rawCode.substring(0, 4).toUpperCase();
            return {
              id: r.item_id || r.id,
              item_code: r.item_code || `IT-${codeSuffix}`,
              item_name: r.item_name || 'Unnamed Item',
              category: r.category || 'General',
              system_qty: Number(r.remaining_qty) || Number(r.quantity) || 0,
              physical_qty: '',
              difference: null,
              condition: '—',
              label_no: '',
              remarks: '',
              status: 'Not Counted'
            };
          });
          setItems(initialItems);
        }
      }
    } catch (err) {
      console.error('Failed to load verification items:', err);
      toast.error('Failed to initialize verification items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [editId, selectedUnitId]);

  // Handle line item field changes
  const handleItemFieldChange = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };

      if (field === 'physical_qty') {
        const valStr = String(value).trim();
        if (valStr === '' || isNaN(Number(valStr))) {
          target.physical_qty = '';
          target.difference = null;
          target.status = 'Not Counted';
        } else {
          const phys = Number(valStr);
          const sys = Number(target.system_qty || 0);
          const diff = phys - sys;
          target.physical_qty = phys;
          target.difference = diff;
          if (diff === 0) target.status = 'Matched';
          else if (diff < 0) target.status = 'Shortage';
          else target.status = 'Excess';
        }
      }

      copy[index] = target;
      return copy;
    });

    if (errors.items) {
      setErrors(prev => ({ ...prev, items: null }));
    }
  };

  // Prompt remove row confirmation modal
  const handlePromptRemoveRow = (index, item) => {
    setItemToRemove({ index, item });
  };

  // Confirmed removal of line item
  const handleConfirmRemoveRow = () => {
    if (itemToRemove !== null) {
      setItems(prev =>
        prev.filter((item, i) => {
          if (itemToRemove.item?.id && item.id) {
            return item.id !== itemToRemove.item.id;
          }
          return i !== itemToRemove.index;
        })
      );
      setItemToRemove(null);
    }
  };

  // Step 1 Validation & Proceed to Step 2
  const handleSubmitToReview = (e) => {
    if (e) e.preventDefault();
    const newErrors = {};

    if (!date) {
      newErrors.date = 'Date is required.';
    }

    if (!verifier1 || !verifier1.trim()) {
      newErrors.verifier1 = 'Verifier 1 name is required.';
    }

    if (items.length === 0) {
      newErrors.items = 'No inventory items available to verify for this unit.';
    } else {
      const hasAtLeastOneCounted = items.some(
        item => item.physical_qty !== '' && item.physical_qty !== null && !isNaN(Number(item.physical_qty))
      );
      if (!hasAtLeastOneCounted) {
        newErrors.items = 'At least one item must have a Physical Quantity entered before proceeding.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please complete the required verification fields.');
      return;
    }

    setErrors({});
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2 Confirm Verification and save to database permanently
  const handleConfirmVerification = async () => {
    if (isExistingConfirmed) {
      navigate('/verification/history');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        unit_id: selectedUnitId || user?.units?.[0]?.id || '11111111-1111-1111-1111-111111111145',
        date,
        year: Number(year),
        verifier_1: verifier1.trim(),
        verifier_2: verifier2.trim(),
        verifier_3: verifier3.trim(),
        verified_by: [verifier1, verifier2, verifier3].map(v => v.trim()).filter(Boolean),
        status: 'confirmed',
        summary: `Annual Physical Count for ${locationDisplay} - ${year}`,
        items: items.map(item => {
          const sys = Number(item.system_qty || 0);
          const hasPhys = item.physical_qty !== '' && item.physical_qty !== null;
          const phys = hasPhys ? Number(item.physical_qty) : null;
          const diff = phys !== null ? phys - sys : 0;

          let status = item.status;
          if (!status || status === 'Not Counted') {
            if (phys === null) status = 'Not Counted';
            else if (diff === 0) status = 'Matched';
            else if (diff < 0) status = 'Shortage';
            else status = 'Excess';
          }

          return {
            item_code: item.item_code,
            item_name: item.item_name,
            category: item.category,
            system_qty: sys,
            physical_qty: phys,
            difference: diff,
            condition: item.condition && item.condition !== '—' ? item.condition : 'Good',
            label_no: item.label_no || '',
            remarks: item.remarks || '',
            status,
            in_inventory: true
          };
        })
      };

      const res = await api.post('/verifications', payload);
      if (res.success) {
        toast.success('Annual verification confirmed and permanently saved.');
        navigate('/verification/history');
      }
    } catch (err) {
      console.error('Failed to confirm verification:', err);
      toast.error(err.message || 'Failed to confirm verification.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/verification');
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/verification' },
        { label: 'New Verification' }
      ]}
    >
      {/* Printable Report Header (Visible ONLY when printing landscape) */}
      <div className="hidden print:block mb-6">
        <div className="border-b-2 border-ink pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-ink uppercase tracking-wide">
                Electricity Distribution Lanka (Pvt) Ltd
              </h1>
              <p className="text-sm font-semibold text-slate mt-0.5">
                Annual Board of Survey — Physical Inventory Verification Report
              </p>
            </div>
            <div className="text-right text-xs font-mono text-slate">
              <div>EDL-IMS AUDIT FORM 04-B</div>
              <div>Cycle Year: {year}</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4 text-xs">
            <div>
              <span className="font-bold text-slate uppercase block">Location</span>
              <span className="font-semibold text-ink">{locationDisplay}</span>
            </div>
            <div>
              <span className="font-bold text-slate uppercase block">Verification Date</span>
              <span className="font-semibold text-ink">{date}</span>
            </div>
            <div>
              <span className="font-bold text-slate uppercase block">Audit Year</span>
              <span className="font-semibold text-ink">{year}</span>
            </div>
            <div>
              <span className="font-bold text-slate uppercase block">Verified By</span>
              <span className="font-semibold text-ink">
                {[verifier1, verifier2, verifier3].filter(Boolean).join(', ') || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">New Verification</h1>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: VERIFICATION ENTRY FORM (Screenshots 1, 2, 5)                      */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Top Form Card */}
          <div className="bg-card border border-line rounded-xl p-5 shadow-card space-y-4">
            {/* 1. LOCATION (read-only, greyed, with map-pin icon) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                Location
              </label>
              <div className="bg-[#F1F3F5] text-slate border border-line rounded-lg py-2.5 px-3 flex items-center gap-2 cursor-not-allowed select-none text-xs font-medium">
                <MapPin className="w-4 h-4 text-slate shrink-0" />
                <span className="truncate">{locationDisplay}</span>
              </div>
            </div>

            {/* 2. Date & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Date <span className="text-[#B4483A]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={handleDateChange}
                    className={`w-full bg-surface border ${
                      errors.date ? 'border-[#B4483A] ring-1 ring-[#B4483A]/30' : 'border-line'
                    } rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-signal transition-colors font-mono`}
                  />
                </div>
                {errors.date && (
                  <p className="text-[11px] text-[#B4483A] font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.date}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || '')}
                  className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-signal font-mono font-medium"
                />
              </div>
            </div>

            {/* 3. Verified By (3 text input boxes side by side) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                Verified By <span className="text-[#B4483A]">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Verifier 1 name"
                    value={verifier1}
                    onChange={(e) => {
                      setVerifier1(e.target.value);
                      if (errors.verifier1) setErrors(prev => ({ ...prev, verifier1: null }));
                    }}
                    className={`w-full bg-surface border ${
                      errors.verifier1 ? 'border-[#B4483A] ring-1 ring-[#B4483A]/30' : 'border-line'
                    } rounded-lg py-2 px-3 text-xs text-ink placeholder-slate focus:outline-none focus:border-signal transition-colors`}
                  />
                  {errors.verifier1 && (
                    <p className="text-[11px] text-[#B4483A] font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.verifier1}</span>
                    </p>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Verifier 2 name"
                    value={verifier2}
                    onChange={(e) => setVerifier2(e.target.value)}
                    className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink placeholder-slate focus:outline-none focus:border-signal"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Verifier 3 name"
                    value={verifier3}
                    onChange={(e) => setVerifier3(e.target.value)}
                    className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink placeholder-slate focus:outline-none focus:border-signal"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Inline Validation Banner if row verification criteria is not satisfied */}
          {errors.items && (
            <div className="p-3 bg-[#B4483A]/10 border border-[#B4483A]/30 text-[#B4483A] text-xs font-medium rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.items}</span>
            </div>
          )}

          {/* Verification Table */}
          <div className="bg-card border border-line rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink border-collapse">
                <thead>
                  <tr className="border-b border-line bg-surface/70 font-semibold text-slate uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3 whitespace-nowrap">Serial No.</th>
                    <th className="py-3 px-4 min-w-[180px]">Item</th>
                    <th className="py-3 px-3 min-w-[130px]">Category</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">System Qty</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Physical Qty</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Difference</th>
                    <th className="py-3 px-3 whitespace-nowrap">Condition</th>
                    <th className="py-3 px-3 whitespace-nowrap min-w-[110px]">Label No</th>
                    <th className="py-3 px-4 min-w-[160px]">Remarks</th>
                    <th className="py-3 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate">
                        <div className="inline-block w-6 h-6 border-2 border-line border-t-ink rounded-full animate-spin mb-2"></div>
                        <div>Loading unit inventory items...</div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate">
                        <div className="text-sm font-medium text-ink">No inventory items found for this unit.</div>
                        <p className="text-xs mt-1 text-slate">Items will appear once recorded in received transactions.</p>
                      </td>
                    </tr>
                  ) : (
                    items.map((row, idx) => {
                      const hasPhysQty = row.physical_qty !== '' && row.physical_qty !== null && !isNaN(Number(row.physical_qty));
                      const diff = hasPhysQty ? Number(row.difference) : null;

                      return (
                        <tr key={row.id || idx} className="hover:bg-surface/50 transition-colors group">
                          {/* 1. No */}
                          <td className="py-3 px-3 text-center text-slate font-mono font-medium">
                            {idx + 1}
                          </td>

                          {/* 2. Serial No. (previously Item Code) */}
                          <td className="py-3 px-3 font-mono font-semibold text-ink whitespace-nowrap">
                            {row.item_code || '—'}
                          </td>

                          {/* 3. Item */}
                          <td className="py-3 px-4 font-semibold text-ink">
                            {row.item_name}
                          </td>

                          {/* 4. Category */}
                          <td className="py-3 px-3 text-slate">
                            {row.category}
                          </td>

                          {/* 5. System Qty (read-only, bold) */}
                          <td className="py-3 px-3 text-center font-bold text-ink font-mono text-sm">
                            {row.system_qty}
                          </td>

                          {/* 6. Physical Qty (numeric input, placeholder "—") */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              placeholder="—"
                              value={row.physical_qty ?? ''}
                              onChange={(e) => handleItemFieldChange(idx, 'physical_qty', e.target.value)}
                              className="w-18 px-2 py-1 text-center font-mono font-bold bg-surface border border-line rounded text-xs text-ink focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal/30"
                            />
                          </td>

                          {/* 7. Difference (auto-calculated, color-coded) */}
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {diff === null ? (
                              <span className="text-slate font-normal">—</span>
                            ) : diff === 0 ? (
                              <span className="text-[#2F7A5C]">0</span>
                            ) : (
                              <span className="text-[#B4483A]">{diff > 0 ? `+${diff}` : diff}</span>
                            )}
                          </td>

                          {/* 8. Condition (dropdown) */}
                          <td className="py-3 px-3">
                            <select
                              value={row.condition || '—'}
                              onChange={(e) => handleItemFieldChange(idx, 'condition', e.target.value)}
                              className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none focus:border-signal"
                            >
                              {CONDITION_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 9. Label No (text input, placeholder "VL-0000") */}
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              placeholder="VL-0000"
                              value={row.label_no || ''}
                              onChange={(e) => handleItemFieldChange(idx, 'label_no', e.target.value)}
                              className="w-24 px-2 py-1 font-mono text-xs bg-surface border border-line rounded text-ink placeholder-slate focus:outline-none focus:border-signal"
                            />
                          </td>

                          {/* 10. Remarks (optional text input) */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="Optional remarks"
                              value={row.remarks || ''}
                              onChange={(e) => handleItemFieldChange(idx, 'remarks', e.target.value)}
                              className="w-full min-w-[140px] px-2 py-1 text-xs bg-surface border border-line rounded text-ink placeholder-slate focus:outline-none focus:border-signal"
                            />
                          </td>

                          {/* 11. Row Remove "x" Button */}
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handlePromptRemoveRow(idx, row)}
                              className="p-1 text-slate hover:text-[#B4483A] rounded transition-colors"
                              title="Remove item from verification"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Action Buttons (Step 1) */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-slate hover:text-ink hover:bg-surface transition-colors shadow-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmitToReview}
              className="px-5 py-2.5 bg-ink hover:bg-[#193254] text-white text-xs font-semibold rounded-lg shadow-subtle transition-all flex items-center gap-1.5"
            >
              <span>Submit</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: REVIEW & CONFIRM SCREEN (Screenshots 3, 4, 6)                      */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Top Banner (Review & Confirm — read-only) */}
          <div className="bg-card border border-line rounded-xl p-3.5 shadow-card flex items-center justify-center gap-2.5 text-xs text-ink no-print">
            <ClipboardCheck className="w-4 h-4 text-signal shrink-0" />
            <span>
              <strong>Review &amp; Confirm</strong> — read-only. Click <strong>Update</strong> to make changes.
            </span>
          </div>

          {/* Summary Card (LOCATION, DATE, YEAR, VERIFIED BY) */}
          <div className="bg-card border border-line rounded-xl p-5 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* LOCATION */}
              <div>
                <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-1">
                  Location
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <MapPin className="w-4 h-4 text-signal shrink-0" />
                  <span className="truncate">{locationDisplay}</span>
                </div>
              </div>

              {/* DATE */}
              <div>
                <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-1">
                  Date
                </div>
                <div className="text-xs font-mono font-bold text-ink">
                  {date}
                </div>
              </div>

              {/* YEAR */}
              <div>
                <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-1">
                  Year
                </div>
                <div className="text-xs font-mono font-bold text-ink">
                  {year}
                </div>
              </div>

              {/* VERIFIED BY */}
              <div>
                <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-1">
                  Verified By
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-ink text-white flex items-center justify-center text-[9px] font-bold">
                      1
                    </span>
                    <span className="text-xs font-medium text-ink">{verifier1 || '—'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-ink text-white flex items-center justify-center text-[9px] font-bold">
                      2
                    </span>
                    <span className="text-xs font-medium text-ink">{verifier2 || '—'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-ink text-white flex items-center justify-center text-[9px] font-bold">
                      3
                    </span>
                    <span className="text-xs font-medium text-ink">{verifier3 || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Read-Only Table */}
          <div className="bg-card border border-line rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink border-collapse">
                <thead>
                  <tr className="border-b border-line bg-surface/70 font-semibold text-slate uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3 whitespace-nowrap">Serial No.</th>
                    <th className="py-3 px-4 min-w-[180px]">Item</th>
                    <th className="py-3 px-3 min-w-[130px]">Category</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">System Qty</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Physical Qty</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Difference</th>
                    <th className="py-3 px-3 whitespace-nowrap">Condition</th>
                    <th className="py-3 px-3 whitespace-nowrap">Label No</th>
                    <th className="py-3 px-4 min-w-[160px]">Remarks</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {items.map((row, idx) => {
                    const hasPhysQty = row.physical_qty !== '' && row.physical_qty !== null && !isNaN(Number(row.physical_qty));
                    const diff = hasPhysQty ? Number(row.difference) : null;

                    return (
                      <tr key={row.id || idx} className="hover:bg-surface/50 transition-colors">
                        {/* 1. No */}
                        <td className="py-3 px-3 text-center text-slate font-mono font-medium">
                          {idx + 1}
                        </td>

                        {/* 2. Serial No. */}
                        <td className="py-3 px-3 font-mono font-semibold text-ink whitespace-nowrap">
                          {row.item_code || '—'}
                        </td>

                        {/* 3. Item */}
                        <td className="py-3 px-4 font-semibold text-ink">
                          {row.item_name}
                        </td>

                        {/* 4. Category */}
                        <td className="py-3 px-3 text-slate">
                          {row.category}
                        </td>

                        {/* 5. System Qty */}
                        <td className="py-3 px-3 text-center font-bold text-ink font-mono text-sm">
                          {row.system_qty}
                        </td>

                        {/* 6. Physical Qty */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-ink">
                          {hasPhysQty ? row.physical_qty : <span className="text-slate font-normal">—</span>}
                        </td>

                        {/* 7. Difference */}
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {diff === null ? (
                            <span className="text-slate font-normal">—</span>
                          ) : diff === 0 ? (
                            <span className="text-[#2F7A5C]">0</span>
                          ) : (
                            <span className="text-[#B4483A]">{diff > 0 ? `+${diff}` : diff}</span>
                          )}
                        </td>

                        {/* 8. Condition */}
                        <td className="py-3 px-3">
                          {row.condition && row.condition !== '—' ? row.condition : <span className="text-slate">—</span>}
                        </td>

                        {/* 9. Label No */}
                        <td className="py-3 px-3 font-mono">
                          {row.label_no || <span className="text-slate">—</span>}
                        </td>

                        {/* 10. Remarks */}
                        <td className="py-3 px-4 text-slate">
                          {row.remarks || <span className="text-slate">—</span>}
                        </td>

                        {/* 11. Status Badge */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {!hasPhysQty ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate/10 text-slate">
                              Not Counted
                            </span>
                          ) : diff === 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#2F7A5C]/10 text-[#2F7A5C] border border-[#2F7A5C]/30">
                              Matched
                            </span>
                          ) : diff < 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#B4483A]/10 text-[#B4483A] border border-[#B4483A]/30">
                              Shortage
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Excess
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Action Buttons (Step 2 - Review Screen) */}
          <div className="flex items-center justify-between pt-2 no-print">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-slate hover:text-ink hover:bg-surface transition-colors shadow-xs"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2.5">
              {/* Print Button */}
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-card hover:bg-surface border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle flex items-center gap-1.5"
                title="Print Landscape Verification Document"
              >
                <Printer className="w-3.5 h-3.5 text-signal" />
                <span>Print</span>
              </button>

              {/* Update Button (Goes back to Step 1 with data intact) */}
              {!isExistingConfirmed && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-3.5 py-2 bg-card hover:bg-surface border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle flex items-center gap-1.5"
                  title="Return to form to edit details"
                >
                  <Save className="w-3.5 h-3.5 text-signal" />
                  <span>Update</span>
                </button>
              )}

              {/* Confirm > Button */}
              {!isExistingConfirmed && (
                <button
                  type="button"
                  onClick={handleConfirmVerification}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-ink hover:bg-[#193254] text-white text-xs font-semibold rounded-lg shadow-subtle transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{submitting ? 'Confirming...' : 'Confirm'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {isExistingConfirmed && (
                <button
                  type="button"
                  onClick={() => navigate('/verification/history')}
                  className="px-5 py-2.5 bg-ink hover:bg-[#193254] text-white text-xs font-semibold rounded-lg shadow-subtle transition-all"
                >
                  Return to History
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Back Button */}
      <div className="no-print">
        <BackButton to="/verification" id="btn-back-verification" />
      </div>

      {/* Confirmation Dialog for Removing Item */}
      <ConfirmModal
        isOpen={!!itemToRemove}
        onClose={() => setItemToRemove(null)}
        onConfirm={handleConfirmRemoveRow}
        title="Remove Item?"
        message="Are you sure you want to remove this item from the verification?"
        itemDetail={
          itemToRemove?.item
            ? `${itemToRemove.item.item_name}${itemToRemove.item.item_code ? ` – ${itemToRemove.item.item_code}` : ''}`
            : null
        }
        confirmLabel="Yes, Remove"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </AppShell>
  );
};

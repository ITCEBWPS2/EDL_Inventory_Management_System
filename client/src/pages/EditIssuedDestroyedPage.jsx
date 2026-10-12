import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Search, ChevronDown, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';

export const EditIssuedDestroyedPage = () => {
  const { id } = useParams();
  const { selectedUnitId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [record, setRecord] = useState(null);

  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // Form fields
  const [selectedSerial, setSelectedSerial] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [disposition, setDisposition] = useState('Issued');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  // Item search dropdown filter
  const [itemSearch, setItemSearch] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.get(`/verifications/issued-destroyed/${id}`),
      api.get('/inventory', { unit_id: selectedUnitId })
    ])
      .then(([recRes, itemRes]) => {
        if (!isMounted) return;
        if (!recRes.success || !recRes.data) {
          setNotFound(true);
          return;
        }

        const recData = recRes.data;
        const allItems = itemRes.success ? (itemRes.data || []) : [];
        setInventoryItems(allItems);
        setRecord(recData);

        // Match current item
        const matched = allItems.find(i => i.id === recData.item_id);
        const currentItem = matched || {
          id: recData.item_id,
          item_name: recData.item_name,
          item_code: recData.item_code,
          serial_number: recData.serial_number,
          quantity: 0
        };
        setSelectedItem(currentItem);

        setSelectedSerial(recData.serial_number || currentItem.serial_number || currentItem.item_code || '');
        setQuantity(recData.quantity || 1);
        setDisposition(recData.disposition || 'Issued');
        setDate(recData.date || new Date().toISOString().split('T')[0]);
        setReason(recData.reason || '');
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

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setItemSearch('');
    setSearchDropdownOpen(false);

    if (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0) {
      setSelectedSerial(item.serial_numbers[0]);
    } else {
      setSelectedSerial(item.serial_number || item.item_code || '');
    }

    const isSingle = !item.is_batch && (!item.serial_numbers || item.serial_numbers.length <= 1) && Number(item.quantity) <= 1;
    if (isSingle) {
      setQuantity(1);
    }

    setErrors(prev => ({ ...prev, item: null, quantity: null }));
  };

  const handleClearItem = () => {
    setSelectedItem(null);
    setSelectedSerial('');
  };

  const isSingleSerialItem = selectedItem && !selectedItem.is_batch && (!selectedItem.serial_numbers || selectedItem.serial_numbers.length <= 1) && Number(selectedItem.quantity) <= 1;
  const isBatchWithSerials = selectedItem && Array.isArray(selectedItem.serial_numbers) && selectedItem.serial_numbers.length > 1;

  // Max allowable quantity takes into account quantity already recorded for this item
  const maxAvailable = selectedItem
    ? (record && record.item_id === selectedItem.id)
      ? Number(selectedItem.quantity || 0) + Number(record.quantity || 0)
      : Number(selectedItem.quantity || 0)
    : 1;

  const filteredItems = inventoryItems.filter(item => {
    if (!itemSearch.trim()) return true;
    const q = itemSearch.toLowerCase().trim();
    return (
      (item.item_name && item.item_name.toLowerCase().includes(q)) ||
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  const validate = () => {
    const errs = {};
    if (!selectedItem) {
      errs.item = 'Please select an inventory item.';
    }
    const numQty = Number(quantity);
    if (!numQty || isNaN(numQty) || numQty < 1) {
      errs.quantity = 'Quantity must be at least 1.';
    } else if (selectedItem && numQty > maxAvailable) {
      errs.quantity = `Quantity cannot exceed available stock (${maxAvailable}).`;
    }
    if (!disposition) {
      errs.disposition = 'Please select a disposition action.';
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
        item_id: selectedItem.id,
        serial_number: selectedSerial || selectedItem.serial_number || selectedItem.item_code || null,
        quantity: Number(quantity),
        disposition,
        reason: reason.trim(),
        date
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
        { label: 'Dashboard', path: '/' },
        { label: 'Annual Verification', path: '/annual-verification' },
        { label: 'Issued / Destroyed Items', path: '/verification/issued-destroyed' },
        { label: 'Edit' }
      ]}
    >
      <div className="py-4">
        {loading ? (
          <div className="max-w-[540px] mx-auto bg-card rounded-xl border border-line shadow-card p-12 text-center text-slate">
            <div className="inline-block w-6 h-6 border-2 border-slate/30 border-t-ink rounded-full animate-spin mb-3"></div>
            <div>Loading record details...</div>
          </div>
        ) : notFound ? (
          <div className="max-w-[540px] mx-auto bg-card rounded-xl border border-line shadow-card p-8 text-center">
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
          /* Centered Form Card (~540px) */
          <div className="max-w-[540px] mx-auto bg-card rounded-xl border border-line shadow-card p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-lg font-semibold text-ink tracking-tight">
                Edit Record
              </h1>
              <p className="text-xs text-slate mt-1 leading-relaxed">
                Record an item that was issued out or destroyed.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* Item Selection Dropdown */}
              <div>
                <label className="block font-medium text-ink mb-1.5">
                  Linked Inventory Item <span className="text-[#B4483A]">*</span>
                </label>

                {!selectedItem ? (
                  <div className="relative">
                    <div
                      onClick={() => setSearchDropdownOpen(prev => !prev)}
                      className="w-full px-3 py-2 bg-surface border border-line rounded-lg flex items-center justify-between cursor-pointer hover:border-slate/40 transition-colors"
                    >
                      <span className="text-slate">Click to select an item...</span>
                      <ChevronDown className="w-4 h-4 text-slate" />
                    </div>

                    {searchDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-card rounded-lg border border-line shadow-modal max-h-60 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-line bg-surface/50">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Search by code, serial or name..."
                              value={itemSearch}
                              onChange={(e) => setItemSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 bg-card border border-line rounded text-xs text-ink placeholder:text-slate/60 focus:outline-none focus:border-signal"
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto flex-1 divide-y divide-line/40">
                          {filteredItems.map(item => (
                            <div
                              key={item.id}
                              onClick={() => handleSelectItem(item)}
                              className="p-2.5 hover:bg-surface cursor-pointer transition-colors flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-ink truncate">{item.item_name}</div>
                                <div className="text-[11px] font-mono text-slate truncate">
                                  {item.item_code} {item.serial_number ? `(${item.serial_number})` : ''}
                                </div>
                              </div>
                              <span className="shrink-0 px-2 py-0.5 rounded bg-surface border border-line text-[11px] text-slate font-medium tabular-nums">
                                Stock: {item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-surface/80 border border-line rounded-lg px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-ink">{selectedItem.item_name}</span>
                      <span className="text-slate font-mono ml-2">[{selectedItem.item_code}]</span>
                      <span className="text-slate ml-2 text-[11px]">(Available stock: {maxAvailable})</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearItem}
                      className="text-[11px] text-signal hover:underline font-medium shrink-0 ml-2"
                    >
                      Change Item
                    </button>
                  </div>
                )}
              </div>

              {/* Row 1: Serial No. & Item Name (Locked & greyed once item is selected) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Serial No. */}
                <div>
                  <label className="block font-medium text-ink mb-1.5">Serial No.</label>
                  {isBatchWithSerials ? (
                    <select
                      value={selectedSerial}
                      onChange={(e) => setSelectedSerial(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-line rounded-lg font-mono text-xs text-ink focus:outline-none focus:border-signal"
                    >
                      {selectedItem.serial_numbers.map((sn, idx) => (
                        <option key={idx} value={sn}>{sn}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={selectedSerial || (selectedItem ? (selectedItem.serial_number || selectedItem.item_code) : '')}
                      placeholder="Auto-filled from item"
                      className="w-full px-3 py-2 bg-surface text-slate border border-line rounded-lg font-mono text-xs cursor-not-allowed"
                    />
                  )}
                </div>

                {/* Item Name */}
                <div>
                  <label className="block font-medium text-ink mb-1.5">Item Name</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={selectedItem ? selectedItem.item_name : ''}
                    placeholder="Auto-filled from item"
                    className="w-full px-3 py-2 bg-surface text-slate border border-line rounded-lg text-xs font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Row 2: Qty, Disposition, Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Qty */}
                <div>
                  <label className="block font-medium text-ink mb-1.5">
                    Qty <span className="text-[#B4483A]">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxAvailable}
                    readOnly={Boolean(isSingleSerialItem)}
                    disabled={Boolean(isSingleSerialItem)}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-xs tabular-nums ${
                      isSingleSerialItem
                        ? 'bg-surface text-slate cursor-not-allowed border-line'
                        : errors.quantity
                        ? 'bg-card border-[#B4483A] text-ink'
                        : 'bg-card border-line text-ink focus:outline-none focus:border-signal'
                    }`}
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-[11px] text-[#B4483A] leading-tight">{errors.quantity}</p>
                  )}
                </div>

                {/* Disposition */}
                <div>
                  <label className="block font-medium text-ink mb-1.5">
                    Disposition <span className="text-[#B4483A]">*</span>
                  </label>
                  <select
                    value={disposition}
                    onChange={(e) => setDisposition(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-line rounded-lg text-xs text-ink focus:outline-none focus:border-signal"
                  >
                    <option value="Issued">Issued</option>
                    <option value="Destroyed">Destroyed</option>
                  </select>
                  {errors.disposition && (
                    <p className="mt-1 text-[11px] text-[#B4483A] leading-tight">{errors.disposition}</p>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="block font-medium text-ink mb-1.5">
                    Date <span className="text-[#B4483A]">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-xs text-ink bg-card focus:outline-none focus:border-signal ${
                      errors.date ? 'border-[#B4483A]' : 'border-line'
                    }`}
                  />
                  {errors.date && (
                    <p className="mt-1 text-[11px] text-[#B4483A] leading-tight">{errors.date}</p>
                  )}
                </div>
              </div>

              {/* Row 3: Reason */}
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
                  id="btn-save-edit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-ink hover:bg-[#193254] rounded-lg transition-colors shadow-subtle flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
};

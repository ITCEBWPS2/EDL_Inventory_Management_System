import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { AppShell } from '../components/layout/AppShell';
import { BackButton } from '../components/common/BackButton';
import { EDL_LOGO } from '../constants/assets';
import edlLogo from '../assets/EDL.png';
import { canCreateDisposalRequest } from '../utils/disposalPermissions';
import { Plus, Trash2, Save, Send, AlertCircle, FileSpreadsheet, Package, Building2 } from 'lucide-react';

export const NewDisposalRequestPage = () => {
  const { user, selectedUnitId, selectedUnit, systemUnits, isSuperAdmin, isLocalAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const navigate = useNavigate();
  const toast = useToast();

  const [availableUnits, setAvailableUnits] = useState([]);
  const [unitId, setUnitId] = useState(selectedUnitId || user?.units?.[0]?.id || user?.unit_id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([
    {
      id: 'item-1',
      item_name: '',
      item_code: '',
      category: '',
      quantity: 1,
      serial_numbers: '',
      condition_notes: ''
    }
  ]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Permission guard: Step 1 can ONLY be accessed by Unit Head and read_write employee for their own unit
  useEffect(() => {
    if (user && !canCreateDisposalRequest(user)) {
      toast.error('You do not have permission to create or edit disposal requests. Only Unit Heads and staff with write permission may create requests for their assigned unit.');
      navigate('/disposal-requests');
    }
  }, [user, navigate]);

  // Load available units strictly restricted to user's assigned units
  useEffect(() => {
    if (!user) return;
    const userUnitIds = [
      user.unit_id,
      ...(Array.isArray(user.unitIds) ? user.unitIds : []),
      ...(Array.isArray(user.units) ? user.units.map(u => u.id) : [])
    ].filter(Boolean);

    let assigned = [];
    if (user.units && user.units.length > 0) {
      assigned = user.units;
    } else if (systemUnits && systemUnits.length > 0) {
      assigned = systemUnits.filter(u => userUnitIds.includes(u.id));
    }

    setAvailableUnits(assigned);

    if (!editId) {
      if (selectedUnitId && userUnitIds.includes(selectedUnitId)) {
        setUnitId(selectedUnitId);
      } else if (assigned.length > 0) {
        setUnitId(assigned[0].id);
      } else if (user.unit_id) {
        setUnitId(user.unit_id);
      }
    }
  }, [user, systemUnits, selectedUnitId, editId]);

  // Load existing draft if editing
  useEffect(() => {
    if (editId) {
      setLoading(true);
      api.get(`/disposal-requests/${editId}`)
        .then(res => {
          if (res.success && res.data) {
            const d = res.data;
            if (d.status !== 'draft') {
              toast.error('Only Draft requests can be edited.');
              navigate(`/disposal-requests/${editId}`);
              return;
            }
            setUnitId(d.unit_id);
            setTitle(d.title || '');
            setDescription(d.description || '');
            if (d.items && d.items.length > 0) {
              setItems(d.items.map((it, idx) => ({
                id: it.id || `item-${idx + 1}`,
                inventory_item_id: it.inventory_item_id || null,
                item_name: it.item_name || '',
                item_code: it.item_code || '',
                category: it.category || '',
                quantity: it.quantity || 1,
                serial_numbers: Array.isArray(it.serial_numbers) ? it.serial_numbers.join(', ') : (it.serial_number || ''),
                condition_notes: it.condition_notes || ''
              })));
            }
          }
        })
        .catch(err => toast.error(err.message || 'Failed to load draft request.'))
        .finally(() => setLoading(false));
    }
  }, [editId]);

  // Load inventory items for selected unit to allow auto-fill
  useEffect(() => {
    const targetUnit = unitId || selectedUnitId;
    if (targetUnit) {
      api.get('/inventory', { unit_id: targetUnit })
        .then(res => {
          if (res.success) {
            setInventoryList(res.data || []);
          }
        })
        .catch(() => { });
    }
  }, [unitId, selectedUnitId]);

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        item_name: '',
        item_code: '',
        category: '',
        quantity: 1,
        serial_numbers: '',
        condition_notes: ''
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      toast.warning('A disposal request must have at least one item.');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSelectInventoryItem = (index, invItem) => {
    if (!invItem) return;
    setItems(prev => {
      const next = [...prev];
      const serials = Array.isArray(invItem.serial_numbers) && invItem.serial_numbers.length > 0
        ? invItem.serial_numbers.join(', ')
        : (invItem.serial_number || '');

      next[index] = {
        ...next[index],
        inventory_item_id: invItem.id,
        item_name: invItem.item_name || '',
        item_code: invItem.item_code || '',
        category: invItem.category || '',
        quantity: invItem.quantity || 1,
        serial_numbers: serials
      };
      return next;
    });
  };

  const validateForm = () => {
    if (!unitId) {
      toast.error('Please select a unit.');
      return false;
    }
    if (!title.trim()) {
      toast.error('Please provide a title or purpose for this request.');
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].item_name.trim()) {
        toast.error(`Item #${i + 1} is missing an item name.`);
        return false;
      }
      if (Number(items[i].quantity) < 1) {
        toast.error(`Item #${i + 1} quantity must be at least 1.`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async (submitNow = false) => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payloadItems = items.map(it => {
        const rawSerials = (it.serial_numbers || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        return {
          id: it.id,
          inventory_item_id: it.inventory_item_id || null,
          item_name: (it.item_name || '').trim(),
          item_code: (it.item_code || '').trim(),
          category: (it.category || '').trim(),
          quantity: Number(it.quantity) || 1,
          serial_numbers: rawSerials,
          serial_number: rawSerials[0] || '',
          condition_notes: (it.condition_notes || '').trim()
        };
      });

      const payload = {
        unit_id: unitId,
        title: title.trim(),
        description: (description || '').trim(),
        items: payloadItems
      };

      let reqId = editId;

      if (editId) {
        const res = await api.put(`/disposal-requests/${editId}`, payload);
        if (!res.success) throw new Error(res.message);
      } else {
        const res = await api.post('/disposal-requests', payload);
        if (!res.success) throw new Error(res.message);
        reqId = res.data.id;
      }

      if (submitNow) {
        const submitRes = await api.post(`/disposal-requests/${reqId}/submit`);
        if (!submitRes.success) throw new Error(submitRes.message);
        toast.success('Disposal request submitted for Board Appointment!');
      } else {
        toast.success(editId ? 'Draft disposal request updated.' : 'Draft disposal request saved.');
      }

      navigate(`/disposal-requests/${reqId}`);
    } catch (err) {
      toast.error(err.message || 'Failed to save disposal request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/verification' },
        { label: 'Disposal Requests', path: '/disposal-requests' },
        { label: editId ? 'Edit Draft Request' : 'New Request' }
      ]}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Branded EDL Hero Header */}
        <div className="bg-gradient-to-r from-card via-surface/60 to-card border border-line rounded-2xl p-5 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">
              {editId ? 'Edit Draft Disposal Request' : 'New Disposal Request'}
            </h1>
            <p className="text-xs text-slate mt-1 flex flex-wrap items-center gap-1.5">
              <span>Initiate a formal asset write-off and disposal workflow</span>
            </p>
          </div>
          <BackButton to="/disposal-requests" label="Back to List" />
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate">Loading request data...</div>
        ) : (
          <div className="space-y-6">
            {/* General Info Card */}
            <div className="bg-card border border-line rounded-xl p-5 space-y-4 shadow-subtle">
              <h2 className="text-sm font-semibold text-ink border-b border-line pb-2">
                1. General Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-signal disabled:opacity-80"
                    disabled={!!editId || availableUnits.length <= 1}
                  >
                    {availableUnits.length === 0 && <option value="">No unit assigned</option>}
                    {(availableUnits || []).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.unit_name || u.name || 'Unit'}{u.unit_code ? ` (${u.unit_code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate mt-1">Disposal requests can only be initiated for your assigned unit.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Request Title / Purpose <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Annual Board of Survey 2026 Asset Disposal"
                    className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-signal"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Card */}
            <div className="bg-card border border-line rounded-xl p-5 space-y-4 shadow-subtle">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    2. Items for Disposal ({items.length})
                  </h2>
                  <p className="text-[11px] text-slate">
                    Specify damaged, obsolete, or unserviceable equipment for committee inspection.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-surface hover:bg-surface/80 border border-line rounded-lg text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors shadow-subtle"
                >
                  <Plus className="w-3.5 h-3.5 text-signal" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 bg-surface/40 border border-line rounded-xl space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate">
                        Item #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate hover:text-rose-600 p-1 rounded transition-colors"
                          title="Remove this item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Pre-fill selector if inventory items available */}
                    {inventoryList.length > 0 && !item.inventory_item_id && (
                      <div>
                        <select
                          onChange={(e) => {
                            const found = inventoryList.find(inv => inv.id === e.target.value);
                            handleSelectInventoryItem(idx, found);
                          }}
                          className="w-full bg-card border border-dashed border-line rounded px-2.5 py-1.5 text-xs text-slate focus:outline-none focus:border-signal"
                        >
                          <option value="">Quick fill from Unit Inventory...</option>
                          {inventoryList.map(inv => (
                            <option key={inv.id} value={inv.id}>
                              {inv.item_name} (Available: {inv.quantity})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-ink mb-1">
                          Item Description <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                          placeholder="e.g. Cisco Catalyst 2960 Switch"
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-semibold text-ink mb-1">
                          Quantity <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs text-ink font-mono focus:outline-none focus:border-signal text-center"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-ink mb-1">
                          Serial Numbers (Comma separated)
                        </label>
                        <input
                          type="text"
                          value={item.serial_numbers}
                          onChange={(e) => handleItemChange(idx, 'serial_numbers', e.target.value)}
                          placeholder="e.g. DGM(WPSII)/CE/001, DGM(WPSII)/CE/002"
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs text-ink font-mono focus:outline-none focus:border-signal"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-ink mb-1">
                          Reason for Disposal
                        </label>
                        <input
                          type="text"
                          value={item.condition_notes}
                          onChange={(e) => handleItemChange(idx, 'condition_notes', e.target.value)}
                          placeholder="e.g. Heavy physical damage, burnt transformer"
                          className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/disposal-requests')}
                className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-slate hover:bg-surface transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSave(false)}
                  className="px-4 py-2 bg-card hover:bg-surface border border-line rounded-lg text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors shadow-subtle disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 text-signal" />
                  <span>{submitting ? 'Saving...' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSave(true)}
                  className="px-4 py-2 bg-signal hover:bg-signal/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-subtle disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Save & Submit'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default NewDisposalRequestPage;


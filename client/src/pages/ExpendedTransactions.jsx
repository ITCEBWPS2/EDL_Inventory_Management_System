import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { RecordModal } from '../components/common/RecordModal';
import { BackButton } from '../components/common/BackButton';
import {
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

const DEFAULT_DISPOSITIONS = [
  'Finco Furnitures',
  'Japura Area',
  'Horana Area',
  'Homagama Area',
  'Avissawella Area',
  'Bandaragama Area',
  'CSC Homagama',
  'CSC Malambe',
  'CSC Pannipitiya',
  'Central Logistics Depot - Kolonnawa',
  'Kelani Cables PLC',
  'ACL Cables PLC',
  'State Trading Corporation',
  'Singer Sri Lanka PLC',
  'Abans IT Solutions',
  'Field Maintenance Team',
  'Auctioned / Scrapped'
];

export const ExpendedTransactions = () => {
  const { user, selectedUnitId, selectedUnit, canWrite } = useAuth();
  const toast = useToast();

  const [transactions, setTransactions] = useState([]);
  const [remainingItems, setRemainingItems] = useState([]);
  const [receivedTransactions, setReceivedTransactions] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedItemFilter, setSelectedItemFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isCustomDisposition, setIsCustomDisposition] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Active unit ID for unit-scoping
  const activeUnitId = selectedUnitId || user?.units?.[0]?.id || user?.unit_id || '';

  const [formData, setFormData] = useState({
    row_no: 1,
    date: new Date().toISOString().split('T')[0],
    voucher_no: '',
    item_id: '',
    quantity: 1,
    disposition: DEFAULT_DISPOSITIONS[0],
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = activeUnitId ? { unit_id: activeUnitId } : {};
      const [txRes, remainingRes, receivedRes, invRes] = await Promise.all([
        api.get('/transactions/expended', queryParams),
        api.get('/transactions/remaining', queryParams),
        api.get('/transactions/received', queryParams),
        api.get('/inventory', queryParams)
      ]);
      if (txRes.success) setTransactions(txRes.data || []);
      if (remainingRes.success) setRemainingItems(remainingRes.data || []);
      if (receivedRes.success) setReceivedTransactions(receivedRes.data || []);
      if (invRes?.success) setInventoryItems(invRes.data || []);
    } catch (err) {
      toast.error('Failed to load expended transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedUnitId]);

  // Compute items that:
  // 1. Have at least one received_transactions entry for the current unit
  // 2. Currently have remaining/available quantity > 0 for that unit
  const expendableItems = useMemo(() => {
    // 1. Track all received transactions scoped to this unit by normalized item_name
    const receivedMap = new Map();
    (receivedTransactions || []).forEach(r => {
      if (activeUnitId && r.unit_id && r.unit_id !== activeUnitId) return;
      const rawName = (r.item_name || '').trim();
      if (!rawName) return;
      const norm = rawName.toLowerCase();
      if (!receivedMap.has(norm)) {
        receivedMap.set(norm, {
          item_name: rawName,
          category: r.category || '',
          total_received: 0,
          total_expended: 0
        });
      }
      const entry = receivedMap.get(norm);
      entry.total_received += Number(r.quantity || 0);
    });

    // 2. Cross-reference with remaining inventory view
    const remainingMap = new Map();
    (remainingItems || []).forEach(rem => {
      const name = (rem.item_name || '').trim().toLowerCase();
      if (name) {
        remainingMap.set(name, rem);
      }
    });

    // 3. Reconcile with expended transactions for this unit
    (transactions || []).forEach(exp => {
      if (activeUnitId && exp.unit_id && exp.unit_id !== activeUnitId) return;
      const rawName = (exp.item_name || '').trim();
      if (!rawName) return;
      const norm = rawName.toLowerCase();
      if (receivedMap.has(norm)) {
        receivedMap.get(norm).total_expended += Number(exp.quantity || 0);
      }
    });

    // 4. Filter down to only items that were actually received AND have available balance > 0
    const list = [];
    receivedMap.forEach((recEntry, norm) => {
      const remView = remainingMap.get(norm);

      let availableQty = 0;
      if (remView && remView.remaining_qty !== undefined) {
        availableQty = Number(remView.remaining_qty);
      } else {
        availableQty = recEntry.total_received - recEntry.total_expended;
      }

      if (availableQty > 0) {
        // Resolve item from inventory items catalog for true item_id and code
        const invMatch = (inventoryItems || []).find(inv => 
          (inv.id && inv.id === recEntry.item_id) || 
          (inv.item_name && inv.item_name.trim().toLowerCase() === norm)
        );

        const resolvedId = invMatch?.id || recEntry.item_id || recEntry.item_name;
        const resolvedCode = invMatch?.item_code || recEntry.item_code || '';
        const resolvedCategory = invMatch?.category || remView?.category || recEntry.category || '';

        list.push({
          item_id: resolvedId,
          item_name: recEntry.item_name,
          item_code: resolvedCode,
          available_qty: availableQty,
          category: resolvedCategory
        });
      }
    });

    // Sort alphabetically by item name
    return list.sort((a, b) => a.item_name.localeCompare(b.item_name));
  }, [receivedTransactions, remainingItems, transactions, inventoryItems, activeUnitId]);

  // Safe item display name resolver
  const getItemDisplayName = (row) => {
    if (row.item_name && row.item_name !== 'Unknown Item') return row.item_name;
    if (row.item_id) {
      const matchRec = (receivedTransactions || []).find(r => r.item_id === row.item_id || r.item_name === row.item_id);
      if (matchRec && matchRec.item_name) return matchRec.item_name;
      const matchInv = (inventoryItems || []).find(i => i.id === row.item_id || i.item_name === row.item_id);
      if (matchInv && matchInv.item_name) return matchInv.item_name;
      if (typeof row.item_id === 'string' && !row.item_id.match(/^[0-9a-f-]{36}$/i)) return row.item_id;
    }
    return row.item_name || '—';
  };

  // If editing an existing transaction, ensure its item is in the options list even if current stock is 0
  const displayItems = useMemo(() => {
    if (isEditing && formData.item_id && !expendableItems.some(i => i.item_id === formData.item_id || i.item_name.toLowerCase() === (formData.item_id || '').toLowerCase())) {
      const existingTx = transactions.find(t => t.id === editingId);
      const rem = remainingItems.find(r => (r.item_name || '').toLowerCase() === (formData.item_id || '').toLowerCase());
      const invMatch = (inventoryItems || []).find(i => i.id === formData.item_id || i.item_name.toLowerCase() === (formData.item_id || '').toLowerCase());
      return [
        {
          item_id: invMatch?.id || formData.item_id,
          item_name: existingTx?.item_name || invMatch?.item_name || formData.item_id,
          item_code: invMatch?.item_code || existingTx?.item_code || '',
          category: invMatch?.category || existingTx?.category || '',
          available_qty: rem?.remaining_qty !== undefined ? Number(rem.remaining_qty) : Number(existingTx?.quantity || 0)
        },
        ...expendableItems
      ];
    }
    return expendableItems;
  }, [expendableItems, isEditing, formData.item_id, transactions, editingId, remainingItems, inventoryItems]);

  // Distinct Items list for the table filter dropdown
  const distinctItemNames = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      const name = getItemDisplayName(t);
      if (name && name !== '—' && name !== 'Unknown Item') set.add(name.trim());
    });
    expendableItems.forEach(i => {
      if (i.item_name && i.item_name.trim()) set.add(i.item_name.trim());
    });
    return Array.from(set).sort();
  }, [transactions, expendableItems, inventoryItems, receivedTransactions]);

  // Combined Dispositions / Destinations list
  const dispositionOptions = useMemo(() => {
    const set = new Set(DEFAULT_DISPOSITIONS);
    transactions.forEach(t => {
      if (t.disposition && t.disposition.trim()) {
        set.add(t.disposition.trim());
      }
    });
    return Array.from(set);
  }, [transactions]);

  // Auto-generate next Voucher Number (e.g. EV-004)
  const generateNextVoucherNo = () => {
    let highest = 0;
    transactions.forEach(t => {
      const match = (t.voucher_no || '').match(/EV[-_]?(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > highest) highest = num;
      }
    });
    const next = highest > 0 ? highest + 1 : (transactions.length + 1);
    return `EV-${String(next).padStart(3, '0')}`;
  };

  // Filtered & Searched data
  const filteredTransactions = useMemo(() => {
    return transactions.filter(row => {
      const displayName = getItemDisplayName(row);
      // 1. Item Filter
      if (selectedItemFilter && displayName !== selectedItemFilter && row.item_name !== selectedItemFilter) {
        return false;
      }

      // 2. Free-text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const vNo = (row.voucher_no || '').toLowerCase();
        const iName = displayName.toLowerCase();
        const disp = (row.disposition || '').toLowerCase();
        const dateStr = row.date ? String(row.date).split('T')[0] : '';
        const notes = (row.notes || '').toLowerCase();

        const matches =
          vNo.includes(q) ||
          iName.includes(q) ||
          disp.includes(q) ||
          dateStr.includes(q) ||
          notes.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [transactions, selectedItemFilter, searchQuery, inventoryItems, receivedTransactions]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Open Add Modal
  const handleOpenAdd = async () => {
    setIsEditing(false);
    setEditingId(null);
    setIsCustomDisposition(false);

    const nextNo = transactions.length + 1;
    const defaultItem = expendableItems[0]?.item_id || '';
    const defaultDisp = DEFAULT_DISPOSITIONS[0];

    setFormData({
      row_no: nextNo,
      date: new Date().toISOString().split('T')[0],
      voucher_no: generateNextVoucherNo(),
      item_id: defaultItem,
      quantity: 1,
      disposition: defaultDisp,
      notes: ''
    });

    setModalOpen(true);

    // Refresh transactions and remaining stock in background
    try {
      const queryParams = activeUnitId ? { unit_id: activeUnitId } : {};
      const [remainingRes, receivedRes] = await Promise.all([
        api.get('/transactions/remaining', queryParams),
        api.get('/transactions/received', queryParams)
      ]);
      if (remainingRes.success) setRemainingItems(remainingRes.data || []);
      if (receivedRes.success) setReceivedTransactions(receivedRes.data || []);
    } catch (err) {}
  };

  // Open Edit Modal
  const handleOpenEdit = (row, indexInPage) => {
    setIsEditing(true);
    setEditingId(row.id);
    const rowNo = indexInPage !== undefined ? (currentPage - 1) * pageSize + indexInPage + 1 : 1;

    const isKnownDisp = dispositionOptions.includes(row.disposition);
    setIsCustomDisposition(!isKnownDisp && Boolean(row.disposition));

    setFormData({
      row_no: rowNo,
      date: row.date ? String(row.date).split('T')[0] : new Date().toISOString().split('T')[0],
      voucher_no: row.voucher_no || '',
      item_id: row.item_id || row.item_name || '',
      quantity: row.quantity || 1,
      disposition: row.disposition || DEFAULT_DISPOSITIONS[0],
      notes: row.notes || ''
    });

    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setIsEditing(false);
    setEditingId(null);
    setIsCustomDisposition(false);
  };

  // Save Expended Record (Add or Edit)
  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (expendableItems.length === 0 && !isEditing) {
      toast.error('No items available to expend for this unit.');
      return;
    }

    if (!formData.item_id) {
      toast.error('Please select an available inventory item.');
      return;
    }

    if (!formData.quantity || Number(formData.quantity) < 1) {
      toast.error('Quantity must be at least 1.');
      return;
    }

    // Verify stock availability
    const chosenItem = displayItems.find(i => 
      i.item_id === formData.item_id || 
      (i.item_name && i.item_name.toLowerCase() === (formData.item_id || '').toLowerCase())
    );
    if (chosenItem) {
      const existingTx = isEditing ? transactions.find(t => t.id === editingId) : null;
      const maxAllowed = isEditing && existingTx && (existingTx.item_id === formData.item_id || existingTx.item_name === formData.item_id)
        ? Number(chosenItem.available_qty) + Number(existingTx.quantity || 0)
        : Number(chosenItem.available_qty);

      if (Number(formData.quantity) > maxAllowed) {
        toast.error(`Quantity exceeds available stock (${maxAllowed} available).`);
        return;
      }
    }

    if (!formData.voucher_no.trim()) {
      toast.error('Voucher number is required.');
      return;
    }

    if (!formData.disposition.trim()) {
      toast.error('Please specify how the item was disposed of.');
      return;
    }

    setModalLoading(true);
    try {
      const resolvedItemId = chosenItem?.item_id || formData.item_id;
      const resolvedItemName = chosenItem?.item_name || formData.item_id;
      const resolvedItemCode = chosenItem?.item_code || '';
      const resolvedCategory = chosenItem?.category || '';

      const payload = {
        item_id: resolvedItemId,
        item_name: resolvedItemName,
        item_code: resolvedItemCode,
        category: resolvedCategory,
        quantity: Number(formData.quantity),
        date: formData.date,
        voucher_no: formData.voucher_no.trim(),
        disposition: formData.disposition.trim(),
        notes: formData.notes || '',
        unit_id: activeUnitId
      };

      if (isEditing && editingId) {
        await api.put(`/transactions/expended/${editingId}`, payload);
        toast.success('Expended record updated successfully.');
      } else {
        await api.post('/transactions/expended', payload);
        toast.success('Expended stock recorded successfully.');
      }

      handleCloseModal();
      await fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to record transaction.');
    } finally {
      setModalLoading(false);
    }
  };

  // Delete Expended Record
  const handleDelete = async (row) => {
    if (!window.confirm(`Are you sure you want to delete expended record ${row.voucher_no}?`)) {
      return;
    }
    try {
      await api.delete(`/transactions/expended/${row.id}`);
      toast.success('Expended record removed.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete transaction.');
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Transactions', path: '/transactions' }, { label: 'Expended Items' }]}>
      {/* Top Bar: Page Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Expended Items</h1>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={handleOpenAdd}
            id="btn-add-expended"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink hover:bg-ink/90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Table Card Container */}
      <div className="bg-card rounded-xl border border-line shadow-card overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface/40">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* "All Items" Filter Dropdown */}
            <div className="relative min-w-[160px]">
              <select
                id="select-item-filter"
                value={selectedItemFilter}
                onChange={(e) => {
                  setSelectedItemFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs bg-card border border-line rounded-lg py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                title="Filter by item"
              >
                <option value="">All Items</option>
                {distinctItemNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>

            {/* Free-text Search Box */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input
                type="text"
                id="input-expended-search"
                placeholder="Search voucher, item, destination..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs bg-card border border-line rounded-lg focus:outline-none focus:border-signal text-ink placeholder-slate shadow-subtle"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-ink p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Reset Filters */}
            {(selectedItemFilter || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedItemFilter('');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 text-xs text-[#B4483A] hover:underline font-medium px-2 py-1 transition-colors"
                title="Reset filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate shrink-0">
            Showing <span className="font-semibold text-ink">{filteredTransactions.length}</span> records
          </div>
        </div>

        {/* Wireframe Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface/70 font-semibold text-slate uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-12 text-center">No.</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4">How Disposed Of</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate">
                    <div className="inline-block w-6 h-6 border-2 border-line border-t-ink rounded-full animate-spin mb-2"></div>
                    <div>Loading expended transactions...</div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate">
                    <div className="text-sm font-medium text-ink">No expended records found.</div>
                    <p className="text-xs mt-1 text-slate">Try adjusting your filter criteria or search query.</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const dateDisplay = row.date ? String(row.date).split('T')[0] : '—';

                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-surface/50 transition-colors group"
                    >
                      {/* 1. No. */}
                      <td className="py-3.5 px-4 text-center text-slate font-mono font-medium">
                        {rowNumber}
                      </td>

                      {/* 2. Date */}
                      <td className="py-3.5 px-4 font-mono text-slate whitespace-nowrap">
                        {dateDisplay}
                      </td>

                      {/* 3. Voucher No */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-ink whitespace-nowrap">
                        {row.voucher_no || '—'}
                      </td>

                      {/* 4. Item — just the item name, no separate item code line underneath */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink leading-tight">
                          {getItemDisplayName(row)}
                        </div>
                      </td>

                      {/* 5. Qty — plain number, not a colored badge */}
                      <td className="py-3.5 px-4 text-center font-medium text-ink tabular-nums">
                        {row.quantity}
                      </td>

                      {/* 6. How Disposed Of — short destination/recipient value */}
                      <td className="py-3.5 px-4 font-medium text-ink">
                        {row.disposition || '—'}
                      </td>

                      {/* 7. Actions — separate Edit and Delete buttons (icon + label) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {canWrite ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(row, idx)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-line rounded-lg text-ink hover:bg-surface hover:border-slate/40 transition-colors shadow-xs"
                                title="Edit record"
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#B4483A]/10 text-[#B4483A] hover:bg-[#B4483A]/20 border border-[#B4483A]/20 rounded-lg transition-colors shadow-xs"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-slate/40 text-xs italic">Read only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-line flex items-center justify-between bg-surface/30 text-xs text-slate">
            <span>
              Page <span className="font-semibold text-ink">{currentPage}</span> of{' '}
              <span className="font-semibold text-ink">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1.5 border border-line rounded hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1.5 border border-line rounded hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Back Button */}
      <BackButton to="/transactions" id="btn-back-transactions" />

      {/* Add / Edit Expended Record Modal */}
      <RecordModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={isEditing ? 'Edit Expended Record' : 'Add Expended Record'}
        onSubmit={handleSave}
        submitLabel="Save"
        loading={modalLoading}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-xs">
          {/* Row 1: No. & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-ink mb-1">No.</label>
              <input
                type="text"
                readOnly
                disabled
                value={formData.row_no}
                className="w-full px-3 py-2 bg-surface/60 border border-line rounded focus:outline-none text-slate cursor-not-allowed font-mono font-medium"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink"
              />
            </div>
          </div>

          {/* Row 2: Voucher No. & Qty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-ink mb-1">Voucher No.</label>
              <input
                type="text"
                required
                placeholder="e.g. EV-004"
                value={formData.voucher_no}
                onChange={(e) => setFormData(p => ({ ...p, voucher_no: e.target.value }))}
                className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink font-mono font-medium"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Qty</label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))}
                className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink font-mono"
              />
            </div>
          </div>

          {/* Row 3: Item (Filtered strictly to received items with remaining stock > 0) */}
          <div>
            <label className="block font-medium text-ink mb-1">
              Item <span className="text-[#B4483A]">*</span>
            </label>
            <select
              required
              disabled={expendableItems.length === 0 && !isEditing}
              value={formData.item_id}
              onChange={(e) => setFormData(p => ({ ...p, item_id: e.target.value }))}
              className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink font-medium disabled:bg-surface/60 disabled:text-slate disabled:cursor-not-allowed"
            >
              {expendableItems.length === 0 && !isEditing ? (
                <option value="">No items available to expend for this unit</option>
              ) : (
                <>
                  <option value="">Select an inventory item...</option>
                  {displayItems.map(item => (
                    <option key={item.item_id} value={item.item_id}>
                      {item.item_name} (Available: {item.available_qty})
                    </option>
                  ))}
                </>
              )}
            </select>
            {expendableItems.length === 0 && !isEditing && (
              <p className="text-[11px] text-slate mt-1 italic">
                Only items with confirmed stock received into this unit can be expended.
              </p>
            )}
          </div>

          {/* Row 4: How Disposed Of */}
          <div>
            <label className="block font-medium text-ink mb-1">
              How Disposed Of <span className="text-[#B4483A]">*</span>
            </label>
            {isCustomDisposition ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Enter destination / recipient..."
                  value={formData.disposition}
                  onChange={(e) => setFormData(p => ({ ...p, disposition: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDisposition(false);
                    setFormData(p => ({ ...p, disposition: DEFAULT_DISPOSITIONS[0] }));
                  }}
                  className="px-3 py-2 border border-line rounded text-slate hover:text-ink transition-colors shrink-0"
                >
                  Choose from list
                </button>
              </div>
            ) : (
              <select
                required
                value={formData.disposition}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomDisposition(true);
                    setFormData(p => ({ ...p, disposition: '' }));
                  } else {
                    setFormData(p => ({ ...p, disposition: e.target.value }));
                  }
                }}
                className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink font-medium"
              >
                <option value="">Select destination / recipient...</option>
                {dispositionOptions.map(disp => (
                  <option key={disp} value={disp}>{disp}</option>
                ))}
                <option value="__custom__">+ Enter Custom Destination...</option>
              </select>
            )}
          </div>
        </div>
      </RecordModal>
    </AppShell>
  );
};

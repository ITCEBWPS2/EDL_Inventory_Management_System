import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { RecordModal } from '../components/common/RecordModal';
import { BackButton } from '../components/common/BackButton';
import { DateInput } from '../components/common/DateInput';
import { AddButton } from '../components/ui/AddButton';
import { EditButton, DeleteButton } from '../components/ui/ActionButtons';
import { Button } from '../components/common/Button';
import { TablePagination } from '../components/common/TablePagination';
import { TransactionsTable } from '../components/common/TransactionsTable';
import { formatDate } from '../utils/formatters';
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
  const { user, selectedUnitId, selectedUnit, canWrite, can } = useAuth();
  const toast = useToast();

  const [transactions, setTransactions] = useState([]);
  const [remainingItems, setRemainingItems] = useState([]);
  const [receivedTransactions, setReceivedTransactions] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedVoucherFilter, setSelectedVoucherFilter] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
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

  // Distinct Vouchers list for filter dropdown
  const distinctVouchers = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      if (t.voucher_no && t.voucher_no.trim()) {
        set.add(t.voucher_no.trim());
      }
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Distinct Dates list for filter dropdown
  const distinctDates = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      if (t.date && String(t.date).trim()) {
        const d = String(t.date).split('T')[0].trim();
        if (d) set.add(d);
      }
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const hasNoDateRecords = useMemo(() => {
    return transactions.some(t => !t.date || !String(t.date).trim());
  }, [transactions]);

  // Filtered & Searched data
  const filteredTransactions = useMemo(() => {
    return transactions.filter(row => {
      const displayName = getItemDisplayName(row);

      // 1. Voucher No filter
      if (selectedVoucherFilter && row.voucher_no !== selectedVoucherFilter) {
        return false;
      }

      // 2. Date filter
      if (selectedDateFilter) {
        const rowDate = row.date ? String(row.date).split('T')[0].trim() : '';
        if (selectedDateFilter === '__NO_DATE__') {
          if (rowDate) return false;
        } else {
          if (rowDate !== selectedDateFilter) return false;
        }
      }

      // 3. Item Filter
      if (selectedItemFilter && displayName !== selectedItemFilter && row.item_name !== selectedItemFilter) {
        return false;
      }

      // 4. Free-text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const vNo = (row.voucher_no || '').toLowerCase();
        const iName = displayName.toLowerCase();
        const disp = (row.disposition || '').toLowerCase();
        const dateStr = row.date ? String(row.date).split('T')[0] : '';
        const dateFormatted = formatDate(row.date);
        const notes = (row.notes || '').toLowerCase();

        const matches =
          vNo.includes(q) ||
          iName.includes(q) ||
          disp.includes(q) ||
          dateStr.includes(q) ||
          (dateFormatted !== '—' && dateFormatted.toLowerCase().includes(q)) ||
          notes.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [transactions, selectedVoucherFilter, selectedDateFilter, selectedItemFilter, searchQuery, inventoryItems, receivedTransactions]);

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
      toast.error('Please specify to whom the item was issued.');
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
        notes: (formData.notes || '').trim(),
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

        <div className="flex flex-wrap items-center gap-2.5">
          {can('add_inventory') && (
            <AddButton
              id="btn-add-expended"
              label="Add"
              onClick={handleOpenAdd}
            />
          )}
        </div>
      </div>

      {/* Shared Transactions Table */}
      <TransactionsTable
        transactions={filteredTransactions}
        paginatedData={paginatedData}
        loading={loading}
        canWrite={can('update_inventory')}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        selectedVoucherFilter={selectedVoucherFilter}
        onVoucherFilterChange={(v) => {
          setSelectedVoucherFilter(v);
          setCurrentPage(1);
        }}
        selectedDateFilter={selectedDateFilter}
        onDateFilterChange={(d) => {
          setSelectedDateFilter(d);
          setCurrentPage(1);
        }}
        selectedItemFilter={selectedItemFilter}
        onItemFilterChange={(i) => {
          setSelectedItemFilter(i);
          setCurrentPage(1);
        }}
        searchQuery={searchQuery}
        onSearchQueryChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        distinctVouchers={distinctVouchers}
        distinctDates={distinctDates}
        hasNoDateRecords={hasNoDateRecords}
        distinctItems={distinctItemNames}
        onResetFilters={() => {
          setSelectedVoucherFilter('');
          setSelectedDateFilter('');
          setSelectedItemFilter('');
          setSearchQuery('');
          setCurrentPage(1);
        }}
        searchPlaceholder="Search voucher, date, destination, item..."
        partyColumnHeader="To Whom Issued"
        partyField="disposition"
        onPartyClick={(party) => {
          setSearchQuery(party);
          setCurrentPage(1);
        }}
        getItemName={getItemDisplayName}
        hasImageColumn={false}
        onEdit={can('update_inventory') ? handleOpenEdit : null}
        onDelete={can('delete_inventory') ? handleDelete : null}
        emptyMessage="No expended records found."
      />

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
              <DateInput
                required
                value={formData.date}
                onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                placeholder="dd/mm/yyyy"
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

          {/* Row 4: To Whom Issued */}
          <div>
            <label className="block font-medium text-ink mb-1">
              To Whom Issued <span className="text-[#B4483A]">*</span>
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
                <Button
                  size="regular"
                  variant="secondary"
                  onClick={() => {
                    setIsCustomDisposition(false);
                    setFormData(p => ({ ...p, disposition: DEFAULT_DISPOSITIONS[0] }));
                  }}
                  label="Choose from list"
                  className="shrink-0"
                />
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

          {/* Row 5: Description (optional multi-line textarea) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-medium text-ink">
                Description <span className="text-slate text-[11px] font-normal">(Optional)</span>
              </label>
              <span className="text-[10px] text-slate font-mono">
                {(formData.notes || '').length}/500
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="e.g. Reason, destination details, condition, serial numbers..."
              value={formData.notes || ''}
              onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink text-xs leading-relaxed"
            />
          </div>
        </div>
      </RecordModal>
    </AppShell>
  );
};

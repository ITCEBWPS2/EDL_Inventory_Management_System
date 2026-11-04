import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DataTable } from '../components/common/DataTable';
import { RecordModal } from '../components/common/RecordModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatNumber } from '../utils/formatters';
import { BatchSerialSubTable } from '../components/inventory/BatchSerialSubTable';
import { isBatchItem } from '../utils/serialNumberGenerator';
import { ChevronRight } from 'lucide-react';

export const InventoryList = () => {
  const { user, selectedUnitId, selectedUnit, canWrite } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    item_name: '',
    item_code: '',
    category: '',
    quantity: 0,
    serial_number: '',
    status: 'In Stock'
  });
  const [modalLoading, setModalLoading] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const q = searchParams.get('search') || '';
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/inventory', { unit_id: selectedUnitId, search: q }),
        api.get('/inventory/categories')
      ]);
      if (itemsRes.success) setItems(itemsRes.data);
      if (catsRes.success) setCategories(catsRes.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load inventory items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedUnitId, searchParams]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      item_name: '',
      item_code: `ITM-${Math.floor(1000 + Math.random() * 9000)}`,
      category: categories[0]?.name || 'Furniture',
      quantity: 1,
      serial_number: '',
      manufacturer_serial_numbers: [''],
      status: 'In Stock'
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const qty = parseInt(item.quantity) || 1;
    let initialMfg = [];
    if (Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.length > 0) {
      initialMfg = [...item.manufacturer_serial_numbers];
    } else if (item.serial_number) {
      initialMfg = [item.serial_number];
    }
    while (initialMfg.length < qty) {
      initialMfg.push('');
    }

    setFormData({
      item_name: item.item_name,
      item_code: item.item_code,
      category: item.category,
      quantity: qty,
      serial_number: item.serial_number || '',
      manufacturer_serial_numbers: initialMfg,
      status: item.status
    });
    setModalOpen(true);
  };

  const handleQuantityChange = (val) => {
    const qty = Math.max(1, parseInt(val) || 1);
    setFormData(prev => {
      const currentMfg = Array.isArray(prev.manufacturer_serial_numbers)
        ? [...prev.manufacturer_serial_numbers]
        : (prev.serial_number ? [prev.serial_number] : []);
      const newMfg = [...currentMfg];
      if (newMfg.length < qty) {
        while (newMfg.length < qty) newMfg.push('');
      } else if (newMfg.length > qty) {
        newMfg.length = qty;
      }
      return {
        ...prev,
        quantity: qty,
        manufacturer_serial_numbers: newMfg,
        serial_number: qty === 1 ? (newMfg[0] ?? prev.serial_number) : prev.serial_number
      };
    });
  };

  const handleUnitMfgChange = (idx, value) => {
    setFormData(prev => {
      const list = Array.isArray(prev.manufacturer_serial_numbers)
        ? [...prev.manufacturer_serial_numbers]
        : [];
      while (list.length < prev.quantity) list.push('');
      list[idx] = value;
      return {
        ...prev,
        manufacturer_serial_numbers: list
      };
    });
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete item "${item.item_name}"?`)) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      toast.success('Inventory item deleted successfully.');
      fetchInventory();
    } catch (err) {
      toast.error(err.message || 'Failed to delete item.');
    }
  };

  const handleSave = async () => {
    if (!formData.item_name || !formData.item_code || !formData.category) {
      toast.error('Item name, code, and category are required.');
      return;
    }

    const qty = Math.max(1, parseInt(formData.quantity) || 1);
    const isBatch = qty > 1;
    const mfgSerials = isBatch
      ? Array.from({ length: qty }).map((_, idx) => (formData.manufacturer_serial_numbers?.[idx] || '').trim())
      : [(formData.serial_number || formData.manufacturer_serial_numbers?.[0] || '').trim()];

    setModalLoading(true);
    try {
      const payload = {
        item_name: formData.item_name.trim(),
        item_code: formData.item_code.trim(),
        category: formData.category,
        quantity: qty,
        serial_number: isBatch ? null : (mfgSerials[0] || null),
        manufacturer_serial_numbers: mfgSerials,
        status: formData.status,
        unit_id: selectedUnitId || user?.units?.[0]?.id
      };

      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        toast.success('Inventory item updated successfully.');
      } else {
        await api.post('/inventory', payload);
        toast.success('New inventory item created.');
      }
      setModalOpen(false);
      fetchInventory();
    } catch (err) {
      toast.error(err.message || 'Failed to save item.');
    } finally {
      setModalLoading(false);
    }
  };

  const columns = [
    {
      header: 'Serial No.',
      accessor: 'item_code',
      tabular: true,
      render: (row, _idx, meta) => {
        const isBatch = isBatchItem(row);
        if (isBatch) {
          return (
            <div className="flex items-start gap-2 select-none group/batch">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  meta?.toggleExpand?.();
                }}
                className={`mt-0.5 p-1 -ml-1 rounded hover:bg-surface text-slate group-hover/batch:text-signal transition-transform duration-150 inline-flex items-center justify-center ${
                  meta?.isExpanded ? 'rotate-90 text-signal font-bold' : ''
                }`}
                title={meta?.isExpanded ? 'Collapse batch serials' : 'Expand batch serials'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  meta?.toggleExpand?.();
                }}
                className="cursor-pointer py-0.5"
                title="Click to expand/collapse batch serial numbers"
              >
                <div className="font-semibold text-ink text-xs group-hover/batch:text-signal transition-colors">
                  {row.batch_label || `${row.sub_classification || row.item_name} Batch (Multi-Serial)`}
                </div>
              </div>
            </div>
          );
        }
        return (
          <span className="font-mono font-semibold text-ink text-xs">{row.item_code}</span>
        );
      }
    },
    {
      header: 'Manufacturer S/N',
      accessor: 'serial_number',
      tabular: true,
      render: (row) => {
        const isBatch = isBatchItem(row);
        if (isBatch) {
          return <span className="text-slate text-xs font-mono select-none">—</span>;
        }
        return (
          <span className="font-mono text-ink text-xs">
            {row.serial_number?.trim() ? row.serial_number : '—'}
          </span>
        );
      }
    },
    {
      header: 'Item Description',
      accessor: 'item_name',
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.item_name}</div>
          {row.serial_number && (
            <div className="text-[10px] text-slate font-mono">SN: {row.serial_number}</div>
          )}
        </div>
      )
    },
    {
      header: 'Category',
      accessor: 'category'
    },
    {
      header: 'Quantity',
      accessor: 'quantity',
      tabular: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-ink tabular-nums">{formatNumber(row.quantity)}</span>
      )
    },
    {
      header: 'Unit / Location',
      accessor: 'unit_name',
      render: (row) => (
        <span className="text-slate text-[11px]">{row.unit_name}</span>
      )
    },
    {
      header: 'Stock Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Inventory' }, { label: 'All Items' }]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Master Item Catalog</h1>
          <p className="text-xs text-slate mt-0.5">
            Registered electrical distribution assets and materials for{' '}
            <span className="font-semibold text-ink">{selectedUnit ? selectedUnit.unit_name : 'All Units'}</span>
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        onAdd={canWrite ? handleOpenAdd : null}
        onEdit={canWrite ? handleOpenEdit : null}
        onDelete={canWrite ? handleDelete : null}
        addLabel="Add Item"
        renderExpandedRow={(row) => <BatchSerialSubTable item={row} />}
        isRowExpandable={(row) => isBatchItem(row)}
        filterOptions={categories.map(c => ({ value: c.name, label: c.name }))}
        filterKey="category"
        searchPlaceholder="Search by item name, serial no..."
        emptyMessage="No catalog items found matching criteria."
        enableSerialSelection={true}
      />

      {/* Add / Edit Item Modal */}
      <RecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Inventory Item' : 'Register New Inventory Item'}
        onSubmit={handleSave}
        submitLabel={editingItem ? 'Update Item' : 'Add Item'}
        loading={modalLoading}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1">Item Name / Description</label>
            <input
              type="text"
              required
              placeholder="e.g. 100 kVA 33kV/400V Distribution Transformer"
              value={formData.item_name}
              onChange={(e) => setFormData(p => ({ ...p, item_name: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink mb-1">Serial No. (Unique)</label>
              <input
                type="text"
                required
                placeholder="TX-100KVA-01"
                value={formData.item_code}
                onChange={(e) => setFormData(p => ({ ...p, item_code: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
              >
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Discontinued">Discontinued</option>
              </select>
            </div>
          </div>

          {/* Manufacturer S/N: Single input if quantity === 1, or per-unit inputs if quantity > 1 */}
          {formData.quantity > 1 ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-ink">
                  Manufacturer S/N per Unit <span className="text-slate text-[11px] font-normal">(Optional)</span>
                </label>
                <span className="text-[11px] text-slate font-medium">
                  {formData.quantity} Units
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-line bg-surface/40 p-2.5">
                {Array.from({ length: formData.quantity }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 bg-card p-2 rounded border border-line">
                    <div className="w-16 shrink-0">
                      <span className="text-xs font-semibold text-ink block">Unit {idx + 1}</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder={`Unit ${idx + 1} Manufacturer S/N (Optional)`}
                        value={formData.manufacturer_serial_numbers?.[idx] || ''}
                        onChange={(e) => handleUnitMfgChange(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-medium text-ink mb-1">
                Manufacturer S/N <span className="text-slate text-[11px] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. SN-TX-2024-8891"
                value={formData.serial_number || formData.manufacturer_serial_numbers?.[0] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(p => ({
                    ...p,
                    serial_number: val,
                    manufacturer_serial_numbers: [val]
                  }));
                }}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono"
              />
            </div>
          )}
        </div>
      </RecordModal>
    </AppShell>
  );
};

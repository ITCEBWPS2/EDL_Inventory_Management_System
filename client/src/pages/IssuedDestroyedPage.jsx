import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DataTable } from '../components/common/DataTable';
import { RecordModal } from '../components/common/RecordModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { BackButton } from '../components/common/BackButton';
import { formatDate, formatNumber } from '../utils/formatters';

export const IssuedDestroyedPage = () => {
  const { user, selectedUnitId, selectedUnit, canWrite } = useAuth();
  const toast = useToast();

  const [records, setRecords] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    item_id: '',
    quantity: 1,
    disposition: 'Scrapped',
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recRes, itemRes] = await Promise.all([
        api.get('/verifications/issued-destroyed', { unit_id: selectedUnitId }),
        api.get('/inventory', { unit_id: selectedUnitId })
      ]);
      if (recRes.success) setRecords(recRes.data);
      if (itemRes.success) setItems(itemRes.data);
    } catch (err) {
      toast.error('Failed to load write-off records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedUnitId]);

  const handleOpenAdd = () => {
    setFormData({
      item_id: items[0]?.id || '',
      quantity: 1,
      disposition: 'Scrapped',
      reason: 'Damaged beyond repair during field operation',
      date: new Date().toISOString().split('T')[0]
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.item_id || !formData.quantity || !formData.disposition || !formData.reason) {
      toast.error('Item, quantity, disposition, and justification reason are required.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/verifications/issued-destroyed', formData);
      toast.success('Disposed item recorded and deducted from inventory.');
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to record disposition.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      tabular: true,
      render: (row) => formatDate(row.date)
    },
    {
      header: 'Item',
      accessor: 'item_name',
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.item_name}</div>
          <div className="text-[10px] text-slate font-mono">{row.item_code}</div>
        </div>
      )
    },
    {
      header: 'Quantity',
      accessor: 'quantity',
      tabular: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-[#B4483A] tabular-nums">
          -{formatNumber(row.quantity)}
        </span>
      )
    },
    {
      header: 'Disposition Action',
      accessor: 'disposition',
      render: (row) => <StatusBadge status={row.disposition} />
    },
    {
      header: 'Reason &amp; Technical Justification',
      accessor: 'reason',
      render: (row) => <span className="text-xs text-slate">{row.reason}</span>
    }
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Annual Verification', path: '/verification' }, { label: 'Issued / Destroyed' }]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">
            Issued, Damaged &amp; Destroyed Items
          </h1>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onAdd={canWrite ? handleOpenAdd : null}
        addLabel="+ Record Write-off"
        searchPlaceholder="Search by item, disposition or reason..."
        emptyMessage="No write-off / destroyed item records found."
      />

      {/* Bottom Back Button */}
      <BackButton to="/verification" id="btn-back-verification" />

      {/* Record Disposition Modal */}
      <RecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Condemned / Destroyed Item"
        onSubmit={handleSave}
        submitLabel="Confirm &amp; Write Off"
        loading={submitting}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1">Select Item Catalog SKU</label>
            <select
              value={formData.item_id}
              onChange={(e) => setFormData(p => ({ ...p, item_id: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
            >
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.item_code} — {item.item_name} (Current: {item.quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink mb-1">Quantity Condemned</label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Disposition Action</label>
              <select
                value={formData.disposition}
                onChange={(e) => setFormData(p => ({ ...p, disposition: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
              >
                <option value="Destroyed">Destroyed</option>
                <option value="Auctioned">Auctioned</option>
                <option value="Scrapped">Scrapped</option>
                <option value="Transferred">Transferred</option>
                <option value="Written Off">Written Off</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
            />
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Engineering Justification / Reason</label>
            <textarea
              rows="3"
              required
              placeholder="e.g. Porcelain bushing fractured, insulation breakdown beyond economical repair..."
              value={formData.reason}
              onChange={(e) => setFormData(p => ({ ...p, reason: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
            />
          </div>
        </div>
      </RecordModal>
    </AppShell>
  );
};

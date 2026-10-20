import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { StatusBadge } from '../components/common/StatusBadge';
import { BackButton } from '../components/common/BackButton';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { SerialNumberCell } from '../components/verification/SerialNumberCell';
import { formatDate } from '../utils/formatters';

export const IssuedDestroyedPage = () => {
  const { selectedUnitId, canWrite } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/verifications/issued-destroyed', { unit_id: selectedUnitId });
      if (res.success) {
        setRecords(res.data || []);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load issued / destroyed records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedUnitId]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/verifications/issued-destroyed/${deleteTarget.id}`);
      if (res.success) {
        toast.success('Record deleted successfully.');
        setDeleteTarget(null);
        await fetchRecords();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/annual-verification' },
        { label: 'Issued / Destroyed Items' }
      ]}
    >
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink tracking-tight">
          Issued / Destroyed Items
        </h1>
        <p className="text-xs text-slate mt-1">
          Records of inventory items issued out of circulation or condemned and destroyed.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-card rounded-xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface/70 text-slate font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4 min-w-[320px] w-[340px]">Serial No.</th>
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4">Disposition</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Reason</th>
                {canWrite && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs text-ink">
              {loading ? (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="py-14 text-center text-slate">
                    <div className="inline-block w-6 h-6 border-2 border-slate/30 border-t-ink rounded-full animate-spin mb-2"></div>
                    <div>Loading issued / destroyed records...</div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="py-14 text-center text-slate">
                    No issued / destroyed records yet.
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-surface/60 transition-colors group"
                  >
                    {/* No */}
                    <td className="py-3 px-4 text-center text-slate tabular-nums font-medium align-top">
                      {idx + 1}
                    </td>

                    {/* Serial No. (stacked, one per line, collapsed with '+ N more' after 3) */}
                    <td className="py-3 px-4 align-top min-w-[320px] w-[340px]">
                      <SerialNumberCell
                        serialNumbers={row.serial_numbers}
                        singleSerial={row.serial_number || row.item_code}
                      />
                    </td>

                    {/* Item Name */}
                    <td className="py-3 px-4 font-medium text-ink">
                      {row.item_name || 'Unknown Item'}
                    </td>

                    {/* Qty (dark rounded pill) */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2.5 py-0.5 rounded-full bg-ink text-white font-semibold text-xs tabular-nums">
                        {row.quantity}
                      </span>
                    </td>

                    {/* Disposition (StatusBadge) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={row.disposition} />
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate tabular-nums">
                      {formatDate(row.date)}
                    </td>

                    {/* Reason (wraps to two lines) */}
                    <td className="py-3 px-4">
                      <span className="line-clamp-2 max-w-xs text-slate leading-relaxed">
                        {row.reason || '—'}
                      </span>
                    </td>

                    {/* Actions (visible only when canWrite) */}
                    {canWrite && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/verification/issued-destroyed/${row.id}/edit`)}
                            title="Edit"
                            className="p-1.5 rounded-md border border-line hover:border-slate/40 hover:bg-surface text-slate hover:text-ink transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            title="Delete"
                            className="p-1.5 rounded-md border border-line hover:border-[#B4483A]/40 hover:bg-[#B4483A]/10 text-slate hover:text-[#B4483A] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Card Footer with "+ Add" button at bottom right */}
        {canWrite && (
          <div className="p-4 border-t border-line bg-surface/30 flex items-center justify-end">
            <button
              type="button"
              id="btn-add-issued-destroyed"
              onClick={() => navigate('/verification/issued-destroyed/add')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink hover:bg-[#193254] text-white rounded-lg text-xs font-semibold shadow-subtle transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add</span>
            </button>
          </div>
        )}
      </div>

      {/* Back Button */}
      <BackButton to="/annual-verification" id="btn-back-verification" />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Record?"
        message="Are you sure you want to delete this issued / destroyed record? This action will restore the item quantity to inventory."
        itemDetail={
          deleteTarget
            ? `${deleteTarget.serial_number || deleteTarget.item_code || 'Item'} — ${deleteTarget.item_name || ''} (Qty: ${deleteTarget.quantity}, Disposition: ${deleteTarget.disposition})`
            : null
        }
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </AppShell>
  );
};

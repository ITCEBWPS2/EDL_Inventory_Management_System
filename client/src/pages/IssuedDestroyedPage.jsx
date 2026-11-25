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
import { formatDate, exportToCSV } from '../utils/formatters';
import { AddButton } from '../components/ui/AddButton';
import { ExportButton } from '../components/ui/ExportButton';
import { EditButton, DeleteButton } from '../components/ui/ActionButtons';

export const IssuedDestroyedPage = () => {
  const { user, selectedUnitId, canWrite, can } = useAuth();
  const canAdd = can('add_inventory');
  const canUpdate = can('update_inventory');
  const canDelete = can('delete_inventory');
  const canExport = can('view_reports');
  const showActions = canUpdate || canDelete;
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

  const handleExportCSV = () => {
    if (!records || records.length === 0) {
      toast.error('No issued or destroyed records available to export.');
      return;
    }
    const exportData = records.map((r, idx) => ({
      'No.': idx + 1,
      'Serial No.': (r.serial_numbers && r.serial_numbers.length > 0) ? r.serial_numbers.join('; ') : (r.serial_number || r.item_code || '—'),
      'Item Name': r.item_name || '—',
      'Quantity': r.quantity,
      'Disposition': r.disposition || '—',
      'Date': formatDate(r.date),
      'Reason': r.reason || '—'
    }));
    exportToCSV(exportData, `EDL_Issued_Destroyed_Items_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Issued/Destroyed records exported to CSV.');
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/annual-verification' },
        { label: 'Issued / Destroyed Items' }
      ]}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">
            Issued / Destroyed Items
          </h1>
          <p className="text-xs text-slate mt-1">
            Records of inventory items issued out of circulation or condemned and destroyed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <ExportButton
              onClick={handleExportCSV}
              label="Export CSV"
              title="Export issued and destroyed records as CSV"
            />
          )}
          {canAdd && (
            <AddButton
              id="btn-add-issued-destroyed"
              label="Add"
              to="/verification/issued-destroyed/add"
            />
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-card rounded-xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full text-left border-collapse"
            style={{
              tableLayout: 'fixed',
              minWidth: showActions ? '1280px' : '1100px'
            }}
          >
            <colgroup>
              <col style={{ width: '56px', minWidth: '56px' }} />
              <col style={{ width: '360px', minWidth: '340px' }} />
              <col style={{ width: '180px', minWidth: '170px' }} />
              <col style={{ width: '90px', minWidth: '90px' }} />
              <col style={{ width: '130px', minWidth: '120px' }} />
              <col style={{ width: '110px', minWidth: '100px' }} />
              <col style={{ width: '220px', minWidth: '180px' }} />
              {showActions && <col style={{ width: '130px', minWidth: '120px' }} />}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-line bg-white text-slate font-semibold text-[11.5px] uppercase tracking-[0.04em]">
                <th className="py-2.5 px-3 text-center" style={{ width: '56px', minWidth: '56px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>No.</th>
                <th className="py-2.5 px-3.5" style={{ width: '360px', minWidth: '340px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Serial No.</th>
                <th className="py-2.5 px-3.5" style={{ width: '180px', minWidth: '170px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Item Name</th>
                <th className="py-2.5 px-3 text-center" style={{ width: '90px', minWidth: '90px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Quantity</th>
                <th className="py-2.5 px-3.5" style={{ width: '130px', minWidth: '120px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Disposition</th>
                <th className="py-2.5 px-3.5" style={{ width: '110px', minWidth: '100px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Date</th>
                <th className="py-2.5 px-3.5" style={{ width: '220px', minWidth: '180px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Reason</th>
                {showActions && <th className="py-2.5 px-3.5 text-right" style={{ width: '130px', minWidth: '120px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs text-ink">
              {loading ? (
                <tr>
                  <td colSpan={showActions ? 8 : 7} className="py-14 text-center text-slate">
                    <div className="inline-block w-6 h-6 border-2 border-slate/30 border-t-ink rounded-full animate-spin mb-2"></div>
                    <div>Loading issued / destroyed records...</div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={showActions ? 8 : 7} className="py-14 text-center text-slate">
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

                    {/* Actions (visible only when showActions) */}
                    {showActions && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {canUpdate && (
                            <EditButton
                              onClick={() => navigate(`/verification/issued-destroyed/${row.id}/edit`)}
                              title="Edit"
                              aria-label={`Edit ${row.item_name || 'record'}`}
                            />
                          )}
                          {canDelete && (
                            <DeleteButton
                              onClick={() => setDeleteTarget(row)}
                              title="Delete"
                              aria-label={`Delete ${row.item_name || 'record'}`}
                            />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DataTable } from '../components/common/DataTable';
import { RecordModal } from '../components/common/RecordModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { Plus, Building2, MapPin, Warehouse } from 'lucide-react';

export const UnitManagementPage = () => {
  const { isSuperAdmin, isLocalAdmin } = useAuth();
  const toast = useToast();

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [formData, setFormData] = useState({
    unit_name: '',
    unit_code: '',
    unit_type: 'unit',
    parent_unit_id: '',
    location: '',
    status: 'active'
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/units');
      if (res.success) setUnits(res.data);
    } catch (err) {
      toast.error('Failed to load organizational units.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setFormData({
      unit_name: '',
      unit_code: `UNIT-${Math.floor(100 + Math.random() * 900)}`,
      unit_type: 'unit',
      parent_unit_id: units[0]?.id || '',
      location: '',
      status: 'active'
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (unit) => {
    setEditingUnit(unit);
    setFormData({
      unit_name: unit.unit_name,
      unit_code: unit.unit_code,
      unit_type: unit.unit_type,
      parent_unit_id: unit.parent_unit_id || '',
      location: unit.location,
      status: unit.status
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.unit_name || !formData.unit_code || !formData.location) {
      toast.error('Unit name, code, and location are required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingUnit) {
        await api.put(`/units/${editingUnit.id}`, formData);
        toast.success('Unit updated successfully.');
      } else {
        await api.post('/units', formData);
        toast.success('Unit created successfully.');
      }
      setModalOpen(false);
      fetchUnits();
    } catch (err) {
      toast.error(err.message || 'Failed to save unit.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Unit Code',
      accessor: 'unit_code',
      tabular: true,
      render: (row) => <span className="font-mono font-semibold text-ink">{row.unit_code}</span>
    },
    {
      header: 'Unit Name',
      accessor: 'unit_name',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.unit_type === 'area' && <Building2 className="w-3.5 h-3.5 text-signal" />}
          {row.unit_type === 'csc' && <MapPin className="w-3.5 h-3.5 text-[#3A6D8C]" />}
          {row.unit_type === 'unit' && <Warehouse className="w-3.5 h-3.5 text-slate" />}
          <span className="font-medium text-ink">{row.unit_name}</span>
        </div>
      )
    },
    {
      header: 'Hierarchy Level',
      accessor: 'unit_type',
      render: (row) => (
        <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded bg-surface border border-line text-ink">
          {row.unit_type}
        </span>
      )
    },
    {
      header: 'Physical Location',
      accessor: 'location'
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Settings' }, { label: 'Units & Locations' }]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Organizational Units &amp; Locations</h1>
          <p className="text-xs text-slate mt-0.5">
            Maintain hierarchical Area &rarr; Sub-area/CSC &rarr; Operational Units infrastructure.
          </p>
        </div>

        {(isSuperAdmin || isLocalAdmin) && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-ink hover:bg-[#193254] text-white text-xs font-medium rounded transition-colors shadow-subtle flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-signal" />
            <span>Add New Unit</span>
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={units}
        loading={loading}
        onEdit={(isSuperAdmin || isLocalAdmin) ? handleOpenEdit : null}
        searchPlaceholder="Search units by code, name, or location..."
        emptyMessage="No organizational units found."
      />

      {/* Add / Edit Unit Modal */}
      <RecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUnit ? 'Edit Unit Information' : 'Add Organizational Unit'}
        onSubmit={handleSave}
        submitLabel={editingUnit ? 'Update Unit' : 'Create Unit'}
        loading={submitting}
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink mb-1">Unit Code</label>
              <input
                type="text"
                required
                placeholder="e.g. DEPOT-KEL"
                value={formData.unit_code}
                onChange={(e) => setFormData(p => ({ ...p, unit_code: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded font-mono text-ink"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Hierarchy Level</label>
              <select
                value={formData.unit_type}
                onChange={(e) => setFormData(p => ({ ...p, unit_type: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded text-ink"
              >
                <option value="area">Area (Regional Executive Office)</option>
                <option value="csc">Sub-area / CSC (Customer Service Center)</option>
                <option value="unit">Unit (Depot / Yard / Store / Substation)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Unit Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Kelaniya Distribution Depot"
              value={formData.unit_name}
              onChange={(e) => setFormData(p => ({ ...p, unit_name: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-line rounded text-ink"
            />
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Parent Unit (Hierarchy)</label>
            <select
              value={formData.parent_unit_id}
              onChange={(e) => setFormData(p => ({ ...p, parent_unit_id: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-line rounded text-ink"
            >
              <option value="">No Parent (Top-level Area)</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.unit_code} — {u.unit_name} ({u.unit_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Physical Location Address</label>
            <input
              type="text"
              required
              placeholder="e.g. Depot Yard 01, Kandy Road, Kelaniya"
              value={formData.location}
              onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-line rounded text-ink"
            />
          </div>
        </div>
      </RecordModal>
    </AppShell>
  );
};

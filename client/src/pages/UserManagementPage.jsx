import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DataTable } from '../components/common/DataTable';
import { RecordModal } from '../components/common/RecordModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate } from '../utils/formatters';
import { buildUnitTree } from '../utils/unitTree';
import { 
  UserCheck, UserX, Shield, Warehouse, Plus, Eye, EyeOff, 
  Search, ChevronDown, ChevronRight, Building2, MapPin, 
  CheckCircle2, AlertCircle 
} from 'lucide-react';

// Recursive Tree Node for the Single-Select Unit Picker
const UnitPickerTreeNode = ({
  node,
  level = 0,
  selectedUnitId,
  onSelectUnit,
  expandedBranches,
  toggleBranch,
  searchQuery
}) => {
  const hasChildren = node.children && node.children.length > 0;
  // A node is a structural branch if unit_type === 'area' or it has children
  const isBranch = node.unit_type === 'area' || hasChildren;
  const isExpanded = searchQuery ? true : (expandedBranches[node.id] !== false); // Auto-expand when searching
  const isSelected = selectedUnitId === node.id;

  // Search filter matching logic (match self or any descendant)
  const matchesSearch = (item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = item.unit_name?.toLowerCase().includes(q) || item.unit_code?.toLowerCase().includes(q);
    const childrenMatch = item.children && item.children.some(c => matchesSearch(c));
    return nameMatch || childrenMatch;
  };

  if (!matchesSearch(node)) return null;

  // Branch / Structural Nodes: Expandable/Collapsible navigation ONLY, never selectable
  if (isBranch) {
    return (
      <div className="select-none text-xs">
        <div
          onClick={() => toggleBranch(node.id)}
          className="flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-slate/10 cursor-pointer text-ink font-semibold transition-colors group"
          style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
          title={`Branch: ${node.unit_name} (${node.unit_code}) - Click to expand/collapse`}
        >
          <button
            type="button"
            className="p-0.5 rounded hover:bg-black/10 text-slate shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleBranch(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate group-hover:text-ink" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate group-hover:text-ink" />
            )}
          </button>
          <Building2 className={`w-3.5 h-3.5 shrink-0 ${level === 0 ? 'text-signal' : 'text-[#3A6D8C]'}`} />
          <span className="truncate">{node.unit_name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-line/50 ml-3.5 space-y-0.5 mt-0.5">
            {node.children.map(child => (
              <UnitPickerTreeNode
                key={child.id}
                node={child}
                level={level + 1}
                selectedUnitId={selectedUnitId}
                onSelectUnit={onSelectUnit}
                expandedBranches={expandedBranches}
                toggleBranch={toggleBranch}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Selectable Leaf Units (CSCs, operational units, labs, etc.)
  return (
    <div
      onClick={() => onSelectUnit(node.id)}
      className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-xs cursor-pointer transition-all border select-none ${
        isSelected
          ? 'bg-signal/15 border-signal text-ink font-semibold shadow-xs ring-1 ring-signal/30'
          : 'bg-card hover:bg-surface border-transparent text-ink hover:border-line/60'
      }`}
      style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
      title={`${node.unit_name} (${node.unit_code}) - ${node.location || ''}`}
    >
      <input
        type="radio"
        name="assigned_unit_radio"
        checked={isSelected}
        onChange={() => onSelectUnit(node.id)}
        className="accent-signal w-4 h-4 cursor-pointer shrink-0"
      />
      {node.unit_type === 'csc' ? (
        <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-signal' : 'text-emerald-600'}`} />
      ) : (
        <Warehouse className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-signal' : 'text-slate'}`} />
      )}
      <span className="truncate flex-1">{node.unit_name}</span>
    </div>
  );
};

export const UserManagementPage = () => {
  const { user: currentUser, isSuperAdmin, isLocalAdmin } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [expandedBranches, setExpandedBranches] = useState({});
  const [emailError, setEmailError] = useState('');

  // Field Refs for validation focus
  const fullNameRef = useRef(null);
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Delete User Confirmation State
  const [userToDelete, setUserToDelete] = useState(null);
  const canDeleteUsers = isSuperAdmin || isLocalAdmin || currentUser?.role === 'super_admin' || currentUser?.role === 'local_admin';

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    role: 'employee',
    permission_level: 'read_write',
    contact_info: '',
    password: '',
    unit_id: '' // Single unit assignment
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, unitsRes] = await Promise.all([
        api.get('/users'),
        api.get('/units')
      ]);
      if (usersRes.success) setUsers(usersRes.data);
      if (unitsRes.success) setUnits(unitsRes.data);
    } catch (err) {
      toast.error('Failed to load user management records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setShowPassword(false);
    setEmailError('');
    setUnitSearch('');
    setFormData({
      username: '',
      full_name: '',
      email: '',
      role: 'employee',
      permission_level: 'read_write',
      contact_info: '',
      password: 'password123',
      unit_id: '' // Unselected initially to require explicit choice
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setShowPassword(false);
    setEmailError('');
    setUnitSearch('');
    const currentUnitId = (user.units && user.units.length > 0) ? user.units[0].id : '';
    setFormData({
      username: user.username,
      full_name: user.full_name,
      email: user.email || '',
      role: user.role,
      permission_level: user.role === 'employee' ? (user.permission_level || 'read_write') : null,
      contact_info: user.contact_info || '',
      password: '',
      unit_id: currentUnitId
    });
    setModalOpen(true);
  };

  const handleToggleStatus = async (user) => {
    try {
      await api.patch(`/users/${user.id}/status`);
      toast.success(`User status changed for ${user.username}.`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle status.');
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const res = await api.delete(`/users/${userToDelete.id}`);
      toast.success(res.message || 'User deleted successfully.');
      setUserToDelete(null);
      await fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user.');
      setUserToDelete(null);
    }
  };

  const handleSave = async () => {
    setEmailError('');

    if (!formData.full_name.trim()) {
      fullNameRef.current?.focus();
      toast.error('Full Legal Name is required.');
      return;
    }

    if (!formData.username.trim()) {
      usernameRef.current?.focus();
      toast.error('Username is required.');
      return;
    }

    const trimmedEmail = (formData.email || '').trim();
    if (!trimmedEmail) {
      setEmailError('Email address is required.');
      emailRef.current?.focus();
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail) || trimmedEmail.includes('..')) {
      setEmailError('Please enter a valid email address.');
      emailRef.current?.focus();
      return;
    }

    if (!formData.role) {
      toast.error('Assigned Role is required.');
      return;
    }

    if (!formData.unit_id) {
      toast.error('Please select an assigned organizational unit for this staff account.');
      return;
    }

    if (!editingUser && !formData.password) {
      passwordRef.current?.focus();
      toast.error('Initial temporary password is required.');
      return;
    }

    const normalizedEmail = trimmedEmail.toLowerCase();
    const payload = {
      ...formData,
      full_name: formData.full_name.trim(),
      username: formData.username.trim(),
      email: normalizedEmail,
      unit_id: formData.unit_id,
      unit_ids: [formData.unit_id], // Single-unit array for backend compatibility
      permission_level: formData.role === 'employee' ? (formData.permission_level || 'read_write') : null
    };

    setSubmitting(true);
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success('User profile updated successfully.');
      } else {
        await api.post('/users', payload);
        toast.success('New staff account created successfully.');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('email')) {
        setEmailError(err.message);
        emailRef.current?.focus();
      }
      toast.error(err.message || 'Failed to save user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBranch = (id) => {
    setExpandedBranches(prev => ({
      ...prev,
      [id]: prev[id] !== undefined ? !prev[id] : false
    }));
  };

  // Build hierarchical unit tree for the single-select picker
  const unitTree = useMemo(() => buildUnitTree(units), [units]);

  // Selected unit object for display feedback
  const selectedUnit = useMemo(() => {
    if (!formData.unit_id || !units) return null;
    return units.find(u => u.id === formData.unit_id) || null;
  }, [formData.unit_id, units]);

  // Form validity check for disabling submit button
  const isFormValid = !!(
    formData.username.trim() &&
    formData.full_name.trim() &&
    formData.role &&
    formData.unit_id &&
    (editingUser || formData.password)
  );

  const columns = [
    {
      header: 'Staff Member',
      accessor: 'full_name',
      render: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.full_name}</div>
          <div className="text-[11px] text-slate font-mono">@{row.username} &bull; {row.email}</div>
        </div>
      )
    },
    {
      header: 'Assigned Role',
      accessor: 'role',
      render: (row) => (
        <span className="font-medium capitalize text-ink">
          {row.role.replace('_', ' ')}
        </span>
      )
    },
    {
      header: 'Permission Level',
      accessor: 'permission_level',
      render: (row) => {
        if (!row.permission_level) return <span className="text-slate text-[11px]">System Full</span>;
        const norm = row.permission_level.replace('_', ' ');
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            row.permission_level === 'read_write'
              ? 'bg-[#2F7A5C]/15 text-[#2F7A5C]'
              : row.permission_level === 'read_only'
              ? 'bg-surface border border-line text-slate'
              : 'bg-[#B4483A]/15 text-[#B4483A]'
          }`}>
            {norm}
          </span>
        );
      }
    },
    {
      header: 'Assigned Unit',
      accessor: 'units',
      render: (row) => (
        <div className="max-w-xs">
          {row.units && row.units.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-ink truncate">{row.units[0].unit_name}</span>
              <span className="text-[10px] bg-surface px-1.5 py-0.5 rounded border border-line text-slate font-mono shrink-0">
                {row.units[0].unit_code}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-slate italic">None assigned</span>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'account_status',
      render: (row) => <StatusBadge status={row.account_status} />
    },
    {
      header: 'Status Control',
      accessor: 'id',
      render: (row) => (
        <button
          onClick={() => handleToggleStatus(row)}
          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
            row.account_status === 'active'
              ? 'border-line text-slate hover:text-[#B4483A] hover:bg-[#B4483A]/10'
              : 'border-[#2F7A5C]/30 text-[#2F7A5C] bg-[#2F7A5C]/10'
          }`}
        >
          {row.account_status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
      )
    }
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'User Management' }, { label: 'Staff & Roles' }]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Staff User Directory &amp; Permissions</h1>
          <p className="text-xs text-slate mt-0.5">
            Administer role-based authorization, employee permission tiers, and organizational unit access scopes.
          </p>
        </div>

        <button
          id="btn-add-staff-account"
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-ink hover:bg-[#193254] text-white text-xs font-medium rounded transition-colors shadow-subtle flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 text-signal" />
          <span>Add Staff Account</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        onEdit={handleOpenEdit}
        onDelete={canDeleteUsers ? handleDeleteClick : null}
        deleteTooltip="Delete user"
        isRowDeletable={(row) => row.id !== currentUser?.id}
        searchPlaceholder="Search staff by name, username, role..."
        emptyMessage="No staff accounts found."
      />

      {/* Add / Edit User Modal */}
      <RecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? `Edit Staff Account: ${editingUser.username}` : 'Add New Staff Account'}
        onSubmit={handleSave}
        submitLabel={editingUser ? 'Save Updates' : 'Create Account'}
        loading={submitting}
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink mb-1">
                Full Legal Name <span className="text-[#B4483A]">*</span>
              </label>
              <input
                ref={fullNameRef}
                type="text"
                required
                placeholder="e.g. Nihal Fernando"
                value={formData.full_name}
                onChange={(e) => setFormData(p => ({ ...p, full_name: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">
                Username <span className="text-[#B4483A]">*</span>
              </label>
              <input
                ref={usernameRef}
                type="text"
                required
                disabled={!!editingUser}
                placeholder="e.g. n.fernando"
                value={formData.username}
                onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink mb-1">
                EDL Corporate Email <span className="text-[#B4483A]">*</span>
              </label>
              <input
                ref={emailRef}
                id="staff-email-input"
                type="email"
                required
                placeholder="n.fernando@edl.lk"
                value={formData.email}
                onChange={(e) => {
                  setFormData(p => ({ ...p, email: e.target.value }));
                  if (emailError) setEmailError('');
                }}
                className={`w-full px-3 py-2 bg-surface border rounded focus:outline-none text-ink transition-colors ${
                  emailError
                    ? 'border-[#B4483A] focus:border-[#B4483A] ring-1 ring-[#B4483A]/30'
                    : 'border-line focus:border-signal'
                }`}
              />
              {emailError && (
                <p className="text-[11px] text-[#B4483A] mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{emailError}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Contact Telephone</label>
              <input
                type="text"
                placeholder="+94 11 2912445"
                value={formData.contact_info}
                onChange={(e) => setFormData(p => ({ ...p, contact_info: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink mb-1">
                Assigned Role <span className="text-[#B4483A]">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setFormData(p => ({
                    ...p,
                    role: newRole,
                    permission_level: newRole === 'employee' ? (p.permission_level || 'read_write') : null
                  }));
                }}
                className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
              >
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                <option value="local_admin">Local Admin</option>
                <option value="unit_head">Unit Head</option>
                <option value="employee">Employee</option>
              </select>
            </div>

            {formData.role === 'employee' ? (
              <div>
                <label className="block font-medium text-ink mb-1">Employee Permission Level</label>
                <select
                  value={formData.permission_level || 'read_write'}
                  onChange={(e) => setFormData(p => ({ ...p, permission_level: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-medium"
                >
                  <option value="read_write">Read Write (Full Inventory Access)</option>
                  <option value="read_only">Read Only (View Only, No Mutations)</option>
                  <option value="no_permission">No Permission (Blocked from Inventory)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-medium text-ink mb-1">Permission Level</label>
                <div className="px-3 py-2 bg-surface border border-line rounded text-slate italic text-[11px]">
                  Disabled (Automatic administrative privileges)
                </div>
              </div>
            )}
          </div>

          {!editingUser && (
            <div>
              <label className="block font-medium text-ink mb-1">
                Initial Temporary Password <span className="text-[#B4483A]">*</span>
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="staff-password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Set initial password"
                  value={formData.password}
                  onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                  className="w-full pl-3 pr-10 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate"
                />
                <button
                  id="toggle-staff-password-visibility"
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-ink transition-colors p-1 rounded focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Single Unit Assignment Tree Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-medium text-ink">
                Assigned Organizational Unit <span className="text-[#B4483A]">*</span>
              </label>
              {isLocalAdmin && (
                <span className="text-[10px] text-signal font-mono font-medium">
                  Scoped to your administrative units
                </span>
              )}
            </div>

            {/* Selected unit feedback banner */}
            {selectedUnit ? (
              <div className="mb-2 p-2.5 bg-[#2F7A5C]/10 border border-[#2F7A5C]/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-[#2F7A5C] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-ink truncate block">
                      {selectedUnit.unit_name}
                    </span>
                    <span className="text-[10px] font-mono text-slate">
                      {selectedUnit.unit_code} • {selectedUnit.unit_type.toUpperCase()}
                      {selectedUnit.location ? ` • ${selectedUnit.location}` : ''}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-[#2F7A5C] bg-[#2F7A5C]/15 px-2 py-0.5 rounded shrink-0">
                  Assigned Unit
                </span>
              </div>
            ) : (
              <div className="mb-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-[11px]">
                  No unit assigned. Please expand a branch below and select exactly one operational unit or CSC.
                </span>
              </div>
            )}

            {/* Unit search filter */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
              <input
                id="unit-filter-search"
                type="text"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                placeholder="Filter operational units, CSCs..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate"
              />
              {unitSearch && (
                <button
                  type="button"
                  onClick={() => setUnitSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate hover:text-ink text-xs px-1"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Tree Picker Container */}
            <div className="p-2.5 bg-surface rounded-lg border border-line max-h-60 overflow-y-auto space-y-1">
              {unitTree.length > 0 ? (
                unitTree.map(root => (
                  <UnitPickerTreeNode
                    key={root.id}
                    node={root}
                    level={0}
                    selectedUnitId={formData.unit_id}
                    onSelectUnit={(id) => setFormData(p => ({ ...p, unit_id: id }))}
                    expandedBranches={expandedBranches}
                    toggleBranch={toggleBranch}
                    searchQuery={unitSearch}
                  />
                ))
              ) : (
                <div className="py-6 text-center text-slate text-xs italic">
                  No organizational units available.
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate mt-1 italic">
              * Click branch nodes (like WPS-II, AREA HORANA) to expand/collapse. Only operational leaf units can be selected.
            </p>
          </div>
        </div>
      </RecordModal>

      {/* Delete User Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete User?"
        message={`Are you sure you want to permanently delete ${userToDelete?.full_name} (@${userToDelete?.username})? This cannot be undone.`}
        itemDetail='Hint: "Deactivate" can be used instead to keep the history.'
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </AppShell>
  );
};

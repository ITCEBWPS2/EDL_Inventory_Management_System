import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/common/Button';
import { User, Lock, KeyRound, Shield, Warehouse, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';

const PERMISSION_DEFS = [
  {
    key: 'view_inventory',
    label: 'View inventory',
    description: 'Browse inventory categories, view sub-categories and inspect stock balances.',
    default: true
  },
  {
    key: 'add_inventory',
    label: 'Add new inventory items',
    description: 'Register new inventory stock and record received items.',
    default: true
  },
  {
    key: 'update_inventory',
    label: 'Update inventory details',
    description: 'Edit item records, adjust stock quantities and update transaction details.',
    default: true
  },
  {
    key: 'delete_inventory',
    label: 'Delete inventory items',
    description: 'Permanently remove items or delete recorded transactions.',
    default: false
  },
  {
    key: 'view_reports',
    label: 'View inventory reports',
    description: 'Access the Reports section, generate summaries and export CSV balances.',
    default: true
  },
  {
    key: 'manage_permissions',
    label: 'Manage inventory permissions',
    description: 'Configure role permissions matrix and manage staff roles.',
    default: false
  }
];

export const SettingsPage = () => {
  const { user, selectedUnit, can } = useAuth();
  const toast = useToast();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Role Permissions Matrix State (Admin Only)
  const [matrix, setMatrix] = useState({
    view_inventory: true,
    add_inventory: true,
    update_inventory: true,
    delete_inventory: false,
    view_reports: true,
    manage_permissions: false
  });
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);

  useEffect(() => {
    if (can('manage_permissions')) {
      fetchMatrix();
    }
  }, []);

  const fetchMatrix = async () => {
    setLoadingMatrix(true);
    try {
      const res = await api.get('/auth/permissions/matrix');
      if (res.success && res.matrix?.employee) {
        setMatrix(res.matrix.employee);
      }
    } catch (err) {
      console.warn('Could not fetch custom permissions matrix, using defaults', err);
    } finally {
      setLoadingMatrix(false);
    }
  };

  const handleTogglePermission = (key, value) => {
    setMatrix(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleResetMatrixDefaults = () => {
    const defaults = {};
    PERMISSION_DEFS.forEach(p => {
      defaults[p.key] = p.default;
    });
    setMatrix(defaults);
    toast.info('Reset to recommended employee defaults (Delete and Manage Permissions restricted).');
  };

  const handleSaveMatrix = async () => {
    setSavingMatrix(true);
    try {
      const res = await api.put('/auth/permissions/matrix', {
        employee: matrix
      });
      if (res.success) {
        toast.success(res.message || 'Role permissions matrix updated successfully.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update permissions matrix.');
    } finally {
      setSavingMatrix(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        username: user?.username,
        old_password: oldPassword,
        new_password: newPassword
      });
      toast.success('Your account password has been successfully updated.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Settings' }, { label: 'Account Profile' }]}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Staff Account Settings</h1>
          <p className="text-xs text-slate mt-0.5">
            Manage your personal profile, credentials, and view active unit authorizations.
          </p>
        </div>

        {/* Profile Details Card */}
        <div className="bg-card rounded-xl border border-line p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="w-12 h-12 rounded-full bg-ink text-signal font-bold text-base flex items-center justify-center border border-line">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">{user?.full_name}</h2>
              <div className="text-xs text-slate font-mono">
                @{user?.username} &bull; {user?.email || 'Corporate Staff'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-surface rounded-lg border border-line">
              <span className="text-slate block mb-1">Corporate System Role:</span>
              <div className="text-sm font-semibold text-ink capitalize flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-signal" />
                <span>{user?.role?.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="p-3.5 bg-surface rounded-lg border border-line">
              <span className="text-slate block mb-1">Inventory Permission Tier:</span>
              <div className="text-sm font-semibold text-ink capitalize flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#2F7A5C]" />
                <span>{user?.permission_level ? user.permission_level.replace('_', ' ') : 'Full Administrative'}</span>
              </div>
            </div>

            <div className="p-3.5 bg-surface rounded-lg border border-line">
              <span className="text-slate block mb-1">Item Category Type Management:</span>
              <div className="text-sm font-semibold text-ink flex items-center gap-1.5">
                {['super_admin', 'local_admin'].includes(user?.role) ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#2F7A5C]" />
                    <span className="text-[#2F7A5C]">Authorized (Add, Edit, Delete Types)</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-slate" />
                    <span className="text-slate">View Only (Restricted to Super Admin &amp; Local Admin)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-2">
              Assigned Operational Units:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {user?.units?.map(u => (
                <div key={u.id} className="p-2.5 bg-surface border border-line rounded flex items-center gap-2 text-xs">
                  <Warehouse className="w-3.5 h-3.5 text-signal" />
                  <div className="truncate">
                    <div className="font-semibold text-ink truncate">{u.unit_name}</div>
                    <div className="text-[10px] text-slate font-mono">{u.unit_code} &bull; {u.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Role Permissions Matrix Card (Admin Only) */}
        {can('manage_permissions') && (
          <div className="bg-card rounded-xl border border-line p-6 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-signal" />
                <div>
                  <h2 className="text-sm font-semibold text-ink">Role Permissions Matrix (Employee Access)</h2>
                  <p className="text-[11px] text-slate">
                    Configure standard capability rules for staff holding the Employee role.
                  </p>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate bg-surface px-2 py-0.5 rounded border border-line self-start sm:self-auto">
                Scope: All Units
              </div>
            </div>

            {loadingMatrix ? (
              <div className="py-8 text-center text-slate text-xs flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-slate/30 border-t-signal rounded-full animate-spin"></div>
                <span>Loading permission rules...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="divide-y divide-line border border-line rounded-lg overflow-hidden bg-surface/30">
                  {PERMISSION_DEFS.map((perm) => {
                    const isAllowed = matrix[perm.key] ?? perm.default;
                    return (
                      <div
                        key={perm.key}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/60 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink text-xs">{perm.label}</span>
                            <span className="font-mono text-[10px] text-slate bg-surface px-1.5 py-0.5 rounded border border-line">
                              {perm.key}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate mt-0.5">{perm.description}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            id={`btn-perm-allow-${perm.key}`}
                            onClick={() => handleTogglePermission(perm.key, true)}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                              isAllowed
                                ? 'bg-[#2F7A5C] text-white shadow-xs'
                                : 'bg-surface text-slate hover:text-ink border border-line'
                            }`}
                          >
                            Allow
                          </button>
                          <button
                            type="button"
                            id={`btn-perm-restrict-${perm.key}`}
                            onClick={() => handleTogglePermission(perm.key, false)}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                              !isAllowed
                                ? 'bg-[#7B1C3E] text-white shadow-xs'
                                : 'bg-surface text-slate hover:text-ink border border-line'
                            }`}
                          >
                            Restrict
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={handleResetMatrixDefaults}
                    className="text-xs text-slate hover:text-ink underline cursor-pointer text-left"
                  >
                    Reset to Recommended Defaults
                  </button>

                  <Button
                    type="button"
                    variant="primary"
                    size="regular"
                    label={savingMatrix ? 'Saving...' : 'Save Permissions'}
                    loading={savingMatrix}
                    disabled={savingMatrix}
                    onClick={handleSaveMatrix}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Change Password Card */}
        <div className="bg-card rounded-xl border border-line p-6 shadow-card">
          <div className="flex items-center gap-2 border-b border-line pb-3 mb-4">
            <KeyRound className="w-4 h-4 text-signal" />
            <h2 className="text-sm font-semibold text-ink">Change Account Password</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md text-xs">
            <div>
              <label className="block font-medium text-ink mb-1">Current Password</label>
              <input
                type="password"
                required
                placeholder="Enter current password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded text-ink"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">New Password</label>
              <input
                type="password"
                required
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded text-ink"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded text-ink"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              variant="primary"
              size="regular"
              label={loading ? 'Updating...' : 'Update Password'}
            />
          </form>
        </div>
      </div>
    </AppShell>
  );
};

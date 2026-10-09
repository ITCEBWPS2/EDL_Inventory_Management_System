import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { User, Lock, KeyRound, Shield, Warehouse, CheckCircle2 } from 'lucide-react';

export const SettingsPage = () => {
  const { user, selectedUnit } = useAuth();
  const toast = useToast();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
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

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-ink hover:bg-[#193254] text-white rounded font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
};

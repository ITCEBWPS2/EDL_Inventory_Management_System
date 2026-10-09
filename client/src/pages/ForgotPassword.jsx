import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AuthCard } from '../components/common/AuthCard';
import { User, Lock, KeyRound } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const ForgotPassword = () => {
  const [username, setUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        username,
        old_password: oldPassword,
        new_password: newPassword
      });
      toast.success(res.message || 'Password reset successfully.');
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <AuthCard
            title="Reset Password"
            subtext="Update credentials for your EDL staff account"
            onSubmit={handleSubmit}
            submitText="Update Password"
            loading={loading}
            error={error}
            footerLink={
              <div>
                Remembered your password?{' '}
                <Link to="/login" className="font-semibold text-ink hover:text-signal transition-colors">
                  Log in
                </Link>
              </div>
            }
          >
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Username</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                <input
                  type="text"
                  required
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink mb-1">
                Current Password (or initial setup password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                <input
                  type="password"
                  placeholder="admin123 or current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink mb-1">New Secure Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate"
                />
              </div>
            </div>
          </AuthCard>
        </div>
      </div>
    </div>
  );
};

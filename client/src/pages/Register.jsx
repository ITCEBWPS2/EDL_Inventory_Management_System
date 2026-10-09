import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const Register = () => {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-line p-8 max-w-md w-full text-center shadow-card">
        <div className="w-14 h-14 rounded-full bg-[#B4483A]/10 text-[#B4483A] flex items-center justify-center mx-auto mb-4 font-bold">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="text-xs font-mono font-bold text-[#B4483A] uppercase tracking-wider mb-1">
          HTTP 403 Forbidden
        </div>
        <h2 className="text-lg font-bold text-ink">Public Registration Disabled</h2>
        <p className="text-xs text-slate mt-2 leading-relaxed">
          Public self-registration is permanently disabled for security and regulatory compliance.
          All EDL IMS staff accounts must be provisioned directly by a <strong>Super Admin</strong> or <strong>Local Admin</strong> through the User Management portal.
        </p>
        <div className="mt-6 pt-6 border-t border-line">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink hover:bg-[#193254] text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Staff Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

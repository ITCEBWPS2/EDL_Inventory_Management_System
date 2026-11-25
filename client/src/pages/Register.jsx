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
            className="inline-flex items-center justify-center gap-2 h-8 px-3.5 rounded-md text-xs font-semibold text-white bg-gradient-to-r from-[#5a1230] to-[#7a1a3c] border border-[rgba(90,18,48,0.40)] hover:brightness-110 active:brightness-95 transition-all shadow-[0_1px_3px_rgba(90,18,48,0.25)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Staff Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Zap } from 'lucide-react';

export const AuthCard = ({
  title,
  subtext,
  children,
  onSubmit,
  submitText = 'Continue',
  loading = false,
  error = null,
  footerLink = null
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md bg-card rounded-xl border border-line shadow-card p-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-ink text-signal flex items-center justify-center mb-3 shadow-subtle">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">{title}</h1>
          <p className="text-sm text-slate mt-1">{subtext}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-[#B4483A]/10 border border-[#B4483A]/20 text-xs text-[#B4483A] font-medium">
            {error}
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          {children}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded bg-ink hover:bg-[#193254] text-white text-sm font-medium transition-colors shadow-subtle disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              submitText
            )}
          </button>
        </form>

        {footerLink && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-card text-slate">Or</span>
              </div>
            </div>

            <div className="text-center text-xs text-slate">
              {footerLink}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

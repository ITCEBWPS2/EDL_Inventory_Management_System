import React from 'react';
import { X } from 'lucide-react';

export const RecordModal = ({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = 'Save Record',
  loading = false,
  maxWidth = 'max-w-xl',
  submitDisabled = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-fade-in">
      <div className={`bg-card rounded-xl border border-line shadow-modal w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden animate-scale-up`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-surface/50">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate hover:text-ink hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {children}
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-line bg-surface/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate hover:text-ink bg-card hover:bg-surface border border-line rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || submitDisabled}
            className="px-5 py-2 text-xs font-medium text-white bg-ink hover:bg-[#193254] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-subtle"
          >
            {loading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : null}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

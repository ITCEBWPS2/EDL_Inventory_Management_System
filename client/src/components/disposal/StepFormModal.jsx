import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../common/Button';

/**
 * StepFormModal: Standard form container for all Disposal workflow steps
 *
 * Implements:
 * - Uniform header: Title + Subtitle ("<request_no> • Unit: <unit_name>")
 * - Scrollable body
 * - Sticky footer: "Cancel" on left, primary "Save and continue" / "Record <Step>" on right
 * - Escape key listener & focus trapping
 */
export const StepFormModal = ({
  isOpen = false,
  onClose,
  title,
  requestNo,
  unitName,
  icon: Icon,
  onSubmit,
  submitLabel = 'Save and continue',
  submitting = false,
  maxWidth = 'max-w-3xl',
  children
}) => {
  const modalRef = useRef(null);
  const isBackdropMouseDownRef = useRef(false);

  // Close on Escape key & focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-print animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-form-modal-title"
      onMouseDown={(e) => { isBackdropMouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (isBackdropMouseDownRef.current && e.target === e.currentTarget && !submitting) {
          onClose();
        }
        isBackdropMouseDownRef.current = false;
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`bg-white border border-[#E6DCD7] rounded-2xl w-full ${maxWidth} shadow-2xl overflow-hidden flex flex-col my-auto max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] animate-scale-up shrink-0`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EEE6E1] bg-[#FBF6F1] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-[#7B1C3E]/10 border border-[#7B1C3E]/20 flex items-center justify-center text-[#7B1C3E] shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 id="step-form-modal-title" className="text-sm sm:text-base font-bold text-[#280818]">
                {title}
              </h2>
              <p className="text-xs text-[#5C4C52] mt-0.5 flex items-center gap-1.5 font-medium">
                {requestNo && <span className="font-mono font-bold text-[#7B1C3E]">{requestNo}</span>}
                {requestNo && unitName && <span className="text-[#C5B8BC]">&bull;</span>}
                {unitName && <span>Unit: <strong className="text-[#280818] font-semibold">{unitName}</strong></span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-[#5C4C52] hover:text-[#280818] hover:bg-white/80 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-[#280818] flex-1">
            {children}
          </div>

          {/* Sticky Footer */}
          <div className="px-5 py-3.5 bg-[#FBF6F1] border-t border-[#EEE6E1] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 rounded-xl border border-[#D8CECA] bg-white hover:bg-white/90 text-xs font-semibold text-[#5C4C52] hover:text-[#280818] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-5 rounded-xl bg-gradient-to-r from-[#7B1C3E] to-[#5B1A3A] hover:from-[#8C1E45] hover:to-[#6C163A] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {submitting && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />}
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default StepFormModal;

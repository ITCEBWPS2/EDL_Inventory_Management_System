import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { safeNode } from '../../utils/safeNode';

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
  const modalRef = useRef(null);
  const openerRef = useRef(null);
  const isBackdropMouseDownRef = useRef(false);

  // Lock body scroll and capture previous active element
  useEffect(() => {
    if (!isOpen) return;

    openerRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, [isOpen]);

  // Escape key & focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusableArr = Array.from(focusables).filter(
          (el) => !el.disabled && el.offsetParent !== null
        );

        if (focusableArr.length === 0) return;

        const first = focusableArr[0];
        const last = focusableArr[focusableArr.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropMouseDown = (e) => {
    isBackdropMouseDownRef.current = (e.target === e.currentTarget);
  };

  const handleBackdropMouseUp = (e) => {
    if (e.target !== e.currentTarget) {
      isBackdropMouseDownRef.current = false;
    }
  };

  const handleBackdropClick = (e) => {
    if (isBackdropMouseDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    isBackdropMouseDownRef.current = false;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto no-print animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-modal-title"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`bg-card rounded-xl border border-line shadow-modal w-full ${maxWidth} max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] flex flex-col overflow-hidden m-auto shrink-0 animate-scale-up`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line bg-surface/50 shrink-0">
          <h2 id="record-modal-title" className="text-base font-semibold text-ink">
            {safeNode(title, '')}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
            icon={X}
          />
        </div>

        {/* Scrollable Form Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 min-h-0">
          {safeNode(children, null)}
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-line bg-surface/50 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="regular"
            onClick={onClose}
            label="Cancel"
          />
          <Button
            variant="primary"
            size="regular"
            onClick={onSubmit}
            disabled={loading || submitDisabled}
            loading={loading}
            label={submitLabel}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

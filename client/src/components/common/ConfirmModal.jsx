import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { safeNode } from '../../utils/safeNode';

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Remove Item?',
  message = 'Are you sure you want to remove this item from the verification?',
  itemDetail,
  confirmLabel = 'Yes, Remove',
  cancelLabel = 'Cancel',
  isDestructive = true,
  confirmDisabled = false,
  loading = false
}) => {
  const confirmBtnRef = useRef(null);
  const openerRef = useRef(null);
  const isBackdropMouseDownRef = useRef(false);

  // Lock body scroll and save opener
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

    // Focus confirm button when dialog opens for keyboard accessibility
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        if (confirmDisabled || loading) return;
        // If a button inside the dialog already has focus, let native click handle it
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
          return;
        }
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, [isOpen, onClose, onConfirm]);

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
      aria-labelledby="confirm-modal-title"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-card rounded-xl border border-line shadow-modal w-full max-w-md max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] flex flex-col overflow-hidden m-auto shrink-0 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDestructive ? 'bg-[#B4483A]/10 text-[#B4483A]' : 'bg-signal/10 text-signal'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 id="confirm-modal-title" className="text-sm font-semibold text-ink">
              {safeNode(title, '')}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
            icon={X}
          />
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 text-xs">
          <p className="text-slate leading-relaxed">
            {safeNode(message, '')}
          </p>

          {itemDetail && (
            <div className="p-3 bg-surface border border-line rounded-lg text-ink font-medium leading-snug break-words">
              {safeNode(itemDetail, '')}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-line bg-surface/50 flex items-center justify-end gap-2.5">
          <Button
            variant="secondary"
            size="regular"
            onClick={onClose}
            label={cancelLabel}
          />
          <Button
            ref={confirmBtnRef}
            variant={isDestructive ? 'danger-solid' : 'primary'}
            size="regular"
            onClick={onConfirm}
            label={confirmLabel}
            disabled={confirmDisabled || loading}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

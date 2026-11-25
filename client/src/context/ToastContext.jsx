import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 3500, action = null) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type, action }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg) => addToast(msg, 'error'), [addToast]);
  const info = useCallback((msg, action = null, duration = 3500) => {
    if (typeof action === 'number') {
      return addToast(msg, 'info', action);
    }
    return addToast(msg, 'info', duration, action);
  }, [addToast]);

  const notifyArrival = useCallback((msg, action = null, duration = 8000) => {
    addToast(msg, 'info', duration, action);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, success, error, info, notifyArrival }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg shadow-card border transition-all duration-200 animate-slide-in ${
              t.type === 'success'
                ? 'bg-card border-[#2F7A5C]/30 text-ink'
                : t.type === 'error'
                ? 'bg-card border-[#B4483A]/30 text-ink'
                : 'bg-card border-line text-ink'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#2F7A5C] shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-[#B4483A] shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-signal shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-snug">{t.message}</div>
              {t.action && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      t.action.onClick?.();
                      removeToast(t.id);
                    }}
                    className="px-3 py-1 bg-signal hover:bg-signal/90 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {t.action.label || 'Open'}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate hover:text-ink shrink-0 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

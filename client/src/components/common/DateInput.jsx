import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { isValidDateParts, toISODate, fromISODate, formatDate } from '../../utils/formatters';

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const START_YEAR = 1990;
export const END_YEAR = new Date().getFullYear() + 10;
export const YEAR_OPTIONS = Array.from(
  { length: END_YEAR - START_YEAR + 1 },
  (_, i) => START_YEAR + i
);

/**
 * Reusable DD/MM/YYYY Date Input Component
 *
 * Props:
 * - value: ISO string "YYYY-MM-DD" or ""
 * - onChange: callback called with { target: { name, id, value: "YYYY-MM-DD" } }
 * - name, id, required, disabled, min, max, placeholder, className, error
 */
export const DateInput = ({
  value = '',
  onChange,
  onBlur: externalOnBlur,
  name,
  id,
  required = false,
  disabled = false,
  min,
  max,
  placeholder = 'dd/mm/yyyy',
  className = '',
  error: externalError,
  autoFocus = false,
  'aria-label': ariaLabel,
  'aria-required': ariaRequired,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  tabIndex,
  ...restProps
}) => {
  const [displayText, setDisplayText] = useState(() => fromISODate(value));
  const [isOpen, setIsOpen] = useState(false);
  const [internalError, setInternalError] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Calendar view state (year & month index 0-11)
  const [viewYear, setViewYear] = useState(() => {
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return parseInt(value.split('-')[0], 10);
    }
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return parseInt(value.split('-')[1], 10) - 1;
    }
    return new Date().getMonth();
  });

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const popupRef = useRef(null);

  // Sync internal display when external value changes
  useEffect(() => {
    const formatted = fromISODate(value);
    setDisplayText(formatted);
    if (formatted) {
      setInternalError('');
      const parts = value.split('-');
      if (parts.length === 3) {
        setViewYear(parseInt(parts[0], 10));
        setViewMonth(parseInt(parts[1], 10) - 1);
      }
    }
  }, [value]);

  // Compute fixed popup coordinates to avoid clipping inside modals/overflows
  const updateCoords = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const popupWidth = 276;
    const popupHeight = 315;
    const margin = 6;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.left;
    if (left + popupWidth > vw - 12) {
      left = Math.max(12, vw - popupWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    let top = rect.bottom + margin;

    // Flip upwards if cramped below
    if (spaceBelow < popupHeight && spaceAbove > spaceBelow) {
      top = Math.max(12, rect.top - popupHeight - margin);
    }

    setCoords({ top, left });
  }, []);

  // Listeners for outside click, Esc, reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleOutsideClick = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        popupRef.current &&
        !popupRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updateCoords();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  // Handle typing with automatic slash masking and date validation
  const handleInputChange = (e) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 8);

    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    setDisplayText(formatted);

    if (digits.length === 0) {
      setInternalError('');
      if (onChange) {
        onChange({ target: { name, id, value: '' } });
      }
    } else if (digits.length === 8) {
      const day = digits.slice(0, 2);
      const month = digits.slice(2, 4);
      const year = digits.slice(4, 8);

      if (!isValidDateParts(day, month, year)) {
        setInternalError('Please enter a valid calendar date');
        if (onChange) {
          onChange({ target: { name, id, value: '' } });
        }
      } else {
        const iso = `${year}-${month}-${day}`;
        if (min && iso < min) {
          setInternalError(`Date cannot be earlier than ${formatDate(min)}`);
        } else if (max && iso > max) {
          setInternalError(`Date cannot be later than ${formatDate(max)}`);
        } else {
          setInternalError('');
          setViewYear(parseInt(year, 10));
          setViewMonth(parseInt(month, 10) - 1);
          if (onChange) {
            onChange({ target: { name, id, value: iso } });
          }
        }
      }
    } else {
      setInternalError('');
    }
  };

  const handleBlur = (e) => {
    const digits = displayText.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 8) {
      setInternalError('Please enter a complete date (DD/MM/YYYY)');
    } else if (digits.length === 8) {
      const day = digits.slice(0, 2);
      const month = digits.slice(2, 4);
      const year = digits.slice(4, 8);
      if (!isValidDateParts(day, month, year)) {
        setInternalError('Please enter a valid calendar date');
      }
    } else if (required && digits.length === 0) {
      setInternalError('Date is required');
    }
    if (externalOnBlur) {
      externalOnBlur(e);
    }
  };

  // Calendar Day Picker
  const handleSelectDay = (day) => {
    const y = viewYear;
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;

    if (min && iso < min) {
      setInternalError(`Date cannot be earlier than ${formatDate(min)}`);
      return;
    }
    if (max && iso > max) {
      setInternalError(`Date cannot be later than ${formatDate(max)}`);
      return;
    }

    setDisplayText(`${d}/${m}/${y}`);
    setInternalError('');
    setIsOpen(false);

    if (onChange) {
      onChange({ target: { name, id, value: iso } });
    }
  };

  const handleSelectToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;

    setViewYear(y);
    setViewMonth(today.getMonth());
    setDisplayText(`${d}/${m}/${y}`);
    setInternalError('');
    setIsOpen(false);

    if (onChange) {
      onChange({ target: { name, id, value: iso } });
    }
  };

  const handleClear = () => {
    setDisplayText('');
    setInternalError('');
    setIsOpen(false);

    if (onChange) {
      onChange({ target: { name, id, value: '' } });
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => Math.max(START_YEAR, y - 1));
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => Math.min(END_YEAR, y + 1));
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Compute Calendar Grid
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Active selected day
  let selectedIso = '';
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    selectedIso = value;
  } else if (displayText.length === 10) {
    selectedIso = toISODate(displayText);
  }

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  const activeError = externalError || internalError;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          tabIndex={tabIndex}
          placeholder={placeholder}
          value={displayText}
          onChange={handleInputChange}
          onBlur={handleBlur}
          maxLength={10}
          aria-label={ariaLabel}
          aria-required={ariaRequired || (required ? 'true' : undefined)}
          aria-invalid={ariaInvalid || (activeError ? 'true' : undefined)}
          aria-describedby={ariaDescribedby}
          className={`w-full px-3 py-2 pr-9 text-xs font-medium text-ink bg-card border rounded transition-colors focus:outline-none focus:border-signal ${
            activeError
              ? 'border-[#dc2626] ring-1 ring-[#dc2626]/30 focus:border-[#dc2626]'
              : 'border-line hover:border-slate/50'
          } ${disabled ? 'bg-surface/50 text-slate cursor-not-allowed opacity-60' : ''} ${className}`}
          {...restProps}
        />

        {/* Calendar Trigger Icon Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen(p => {
                const next = !p;
                if (next) {
                  // If opening, ensure view month/year matches current value or today
                  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                    setViewYear(parseInt(value.split('-')[0], 10));
                    setViewMonth(parseInt(value.split('-')[1], 10) - 1);
                  }
                }
                return next;
              });
            }
          }}
          tabIndex={-1}
          aria-label="Open calendar"
          className="absolute right-2.5 text-slate hover:text-ink transition-colors p-0.5 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {activeError && (
        <p id={ariaDescribedby} className="mt-1 text-[12px] text-[#dc2626] leading-tight font-medium">
          {activeError}
        </p>
      )}

      {/* Calendar Popup Portaled into document.body to prevent clipping */}
      {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: '276px',
            zIndex: 99999
          }}
          className="bg-card border border-line rounded-xl shadow-2xl p-3 animate-fade-in text-ink select-none"
        >
          {/* Header: Month & Year Selectors + Arrows */}
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-line gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded hover:bg-surface text-slate hover:text-ink transition-colors shrink-0"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 grow justify-center">
              {/* Month Selector */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-surface border border-line rounded px-1.5 py-1 text-xs font-semibold text-ink focus:outline-none focus:border-signal cursor-pointer hover:border-slate/50 transition-colors"
                aria-label="Select month"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="bg-surface border border-line rounded px-1.5 py-1 text-xs font-semibold text-ink font-mono focus:outline-none focus:border-signal cursor-pointer hover:border-slate/50 transition-colors"
                aria-label="Select year"
              >
                {YEAR_OPTIONS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded hover:bg-surface text-slate hover:text-ink transition-colors shrink-0"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate uppercase mb-1">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="py-0.5">{d}</div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {/* Previous month overflow days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const prevDay = daysInPrevMonth - firstDayOfWeek + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="py-1 text-center text-slate/40 text-[11px]"
                >
                  {prevDay}
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
              const day = i + 1;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = selectedIso === iso;
              const isToday = todayStr === iso;
              const isDisabled = (min && iso < min) || (max && iso > max);

              return (
                <button
                  key={`curr-${day}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(day)}
                  className={`py-1 text-center rounded text-xs transition-colors font-medium ${
                    isSelected
                      ? 'bg-signal text-white font-bold shadow-sm'
                      : isToday
                      ? 'border border-signal text-signal font-bold hover:bg-signal/10'
                      : isDisabled
                      ? 'text-slate/30 cursor-not-allowed'
                      : 'hover:bg-surface text-ink'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts */}
          <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className="font-semibold text-signal hover:underline"
            >
              Today
            </button>
            {!required && (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate hover:text-[#B4483A] transition-colors flex items-center gap-0.5 font-medium"
                title="Clear date"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

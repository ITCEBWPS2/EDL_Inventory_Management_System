import React from 'react';
import { Link } from 'react-router-dom';
import { formatNumber } from '../../utils/formatters';

export const StatCard = ({
  label,
  value,
  displayValue = null,
  to = null,
  subtext = null,
  highlight = false,
  badgeText = null,
  badgeClass = '',
  className = '',
  loading = false,
  valueColor = null,
  icon: Icon = null,
  iconColor = null,
  variant = 'card', // 'card' | 'chip'
  compact = false,
  id = undefined
}) => {
  const hasExtra = Boolean(subtext || badgeText);

  // Compute displayed value
  let formattedVal = '—';
  if (displayValue !== null && displayValue !== undefined) {
    formattedVal = String(displayValue);
  } else if (value !== null && value !== undefined) {
    formattedVal = typeof value === 'number' ? formatNumber(value) : String(value);
  }

  // Inline chip presentation variant (for compact toolbars and headers)
  if (variant === 'chip' || compact) {
    return (
      <div
        id={id}
        className={`stat-card-chip inline-flex items-center gap-1.5 h-[32px] px-2.5 py-1 rounded-lg bg-[rgba(123,28,62,0.06)] border border-[rgba(123,28,62,0.18)] text-xs text-[#7B1C3E] select-none ${className}`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-[#7B1C3E] shrink-0" aria-hidden="true" />}
        {loading ? (
          <div className="h-4 w-8 rounded bg-black/10 animate-pulse" />
        ) : (
          <span className="font-bold tabular-nums text-[#1B1B24]">{formattedVal}</span>
        )}
        <span className="text-[#4A4D5A] font-medium">{label}</span>
        {badgeText && (
          <span className="text-[10px] px-1 py-0.2 rounded bg-white/70 border border-[rgba(123,28,62,0.15)] font-semibold text-[#7B1C3E]">
            {badgeText}
          </span>
        )}
      </div>
    );
  }

  const cardClasses = `stat-card-root group glass-card transition-all duration-200 ${
    hasExtra
      ? 'p-4 flex flex-col justify-between'
      : 'px-4 py-3 flex flex-col justify-center min-h-[84px] max-h-[92px] h-[88px]'
  } ${
    highlight
      ? 'stat-card-highlight text-white'
      : 'text-[#280818] hover:border-white'
  } ${
    to
      ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6c026] focus-visible:ring-offset-2'
      : ''
  } ${className}`;

  const cardStyle = highlight
    ? {
        background: 'rgba(123, 28, 62, 0.94)',
        border: '1px solid rgba(246, 192, 38, 0.65)',
        borderRadius: '16px',
        boxShadow: '0 4px 14px rgba(10, 10, 25, 0.14), 0 0 0 1px rgba(246, 192, 38, 0.35)'
      }
    : undefined;

  const content = (
    <>
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline justify-between gap-2">
          {loading ? (
            <div
              className={`h-7 w-20 rounded-md animate-pulse my-0.5 ${
                highlight ? 'bg-white/20' : 'bg-black/10'
              }`}
              aria-hidden="true"
            />
          ) : (
            <div
              className={`text-[28px] font-bold tabular-nums tracking-tight leading-none ${
                highlight ? 'text-white' : (valueColor ? '' : 'text-[#280818]')
              }`}
              style={!highlight && valueColor ? { color: valueColor } : undefined}
            >
              {formattedVal}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {badgeText && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                  badgeClass || (highlight ? 'bg-white/20 text-white' : 'bg-[#fcfbf9] border border-[#eee6e1] text-[#8a7a80]')
                }`}
              >
                {badgeText}
              </span>
            )}
            {Icon && (
              <span
                aria-hidden="true"
                className={`w-6 h-6 rounded-md shrink-0 flex items-center justify-center transition-colors ${
                  highlight
                    ? 'text-white/70 bg-white/10'
                    : (iconColor ? '' : 'text-slate/60 bg-black/5')
                }`}
                style={!highlight && iconColor ? { color: iconColor } : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>

        {/* Thin, short gold accent line */}
        <div
          aria-hidden="true"
          className="stat-card-accent-line"
          style={{
            width: '20px',
            height: '2px',
            borderRadius: '1px',
            backgroundColor: '#f6c026',
            marginTop: '5px',
            marginBottom: '3px'
          }}
        />

        <div
          className={`text-xs font-semibold leading-tight transition-colors truncate ${
            highlight ? 'text-white/95' : 'text-[#4A4D5A] group-hover:text-[#280818]'
          }`}
        >
          {label}
        </div>
      </div>

      {subtext && (
        <div
          className={`text-[10px] mt-2 pt-1.5 border-t ${
            highlight ? 'text-white/80 border-white/20' : 'text-[#4A4D5A] border-[rgba(27,27,36,0.09)]'
          }`}
        >
          {subtext}
        </div>
      )}
    </>
  );

  const ariaLabel = `${label}: ${formattedVal}`;

  if (to) {
    return (
      <Link
        to={to}
        id={id}
        className={cardClasses}
        style={cardStyle}
        data-highlight={highlight ? 'true' : 'false'}
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      id={id}
      className={cardClasses}
      style={cardStyle}
      data-highlight={highlight ? 'true' : 'false'}
      aria-label={ariaLabel}
    >
      {content}
    </div>
  );
};

export default StatCard;


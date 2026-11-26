import React from 'react';

/**
 * StepActionButton: Uniform 36px action button for Disposal Workflow
 *
 * Variants:
 * - 'primary': Maroon-filled button (#7B1C3E hover:#5B1A3A text-white), 36px height, 10px radius, 16px icon.
 * - 'secondary' | 'outline': White background, maroon outline, maroon text.
 * - 'danger-outline': White background, red outline (#B3261E), red text.
 */
export const StepActionButton = ({
  variant = 'primary',
  label,
  children,
  icon: Icon,
  count = null,
  onClick,
  disabled = false,
  loading = false,
  title,
  id,
  type = 'button',
  className = '',
  ...rest
}) => {
  const displayLabel = label || children;

  let baseStyle = 'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-xs font-bold transition-all select-none shrink-0 shadow-xs active:scale-95 cursor-pointer';

  if (variant === 'primary') {
    baseStyle += ' bg-gradient-to-r from-[#7B1C3E] to-[#5B1A3A] hover:from-[#8C1E45] hover:to-[#6C163A] text-white shadow-md hover:shadow-lg border border-[#5B1A3A] ring-1 ring-white/20';
  } else if (variant === 'danger-outline') {
    baseStyle += ' bg-white hover:bg-[#FDF1F1] text-[#B3261E] border border-[#B3261E]/50 hover:border-[#B3261E] h-[34px] px-3 font-semibold';
  } else {
    // Secondary / outline (e.g. Print Report)
    baseStyle += ' bg-white hover:bg-[#F7E9EE] text-[#7B1C3E] border-2 border-[#7B1C3E] hover:border-[#5B1A3A]';
  }

  if (disabled || loading) {
    baseStyle += ' opacity-55 cursor-not-allowed pointer-events-none active:scale-100 shadow-none';
  }

  return (
    <button
      type={type}
      id={id}
      onClick={onClick}
      disabled={disabled || loading}
      title={title || (typeof displayLabel === 'string' ? displayLabel : undefined)}
      className={`${baseStyle} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : null}

      <span>{displayLabel}</span>

      {typeof count === 'number' && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold leading-none ${
            variant === 'primary'
              ? 'bg-white/25 text-white ring-1 ring-white/30'
              : 'bg-[#7B1C3E]/10 text-[#7B1C3E]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

export default StepActionButton;

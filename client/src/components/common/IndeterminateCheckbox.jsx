import React, { useRef, useEffect } from 'react';

/**
 * Accessible Checkbox component that supports the 'indeterminate' state
 */
export const IndeterminateCheckbox = ({
  checked = false,
  indeterminate = false,
  onChange = () => {},
  disabled = false,
  title = '',
  className = '',
  id = undefined,
  'aria-label': ariaLabel = undefined
}) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate && !checked);
    }
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      checked={Boolean(checked)}
      disabled={disabled}
      title={title}
      onChange={onChange}
      aria-label={ariaLabel || title}
      className={`w-4 h-4 rounded border-line text-signal accent-signal focus:ring-2 focus:ring-signal/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 transition-all ${className}`}
    />
  );
};


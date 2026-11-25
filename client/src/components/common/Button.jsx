import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * Standard Unified Button System (EDL IMS)
 *
 * Size Scale:
 * - 'regular' (default): 36px height, 14px padding, 13.5px font-size, 600 weight, 10px radius, 16px icon, 6px gap.
 * - 'small' | 'sm': 30px height, 11px padding, 12.5px font-size, 550 weight, 8px radius, 14px icon, 5px gap.
 * - 'icon' | 'icon-regular': 36x36px square, 10px radius, 16px icon.
 * - 'icon-sm' | 'icon-small': 30x30px square, 8px radius, 14px icon.
 *
 * Variants:
 * - 'primary': Brand maroon gradient fill (#5a1230 -> #7a1a3c), white text.
 * - 'secondary' | 'outline': White background, maroon-tinted line border, dark text.
 * - 'danger-soft' | 'danger': Soft red background (#fdf1f1), border (#f3cfcf), red text (#b42318).
 * - 'danger-solid': Solid red background (#b42318), white text.
 * - 'ghost': Transparent background, hover background tint.
 */
export const Button = forwardRef(({
  variant = 'secondary',
  size = 'regular',
  children,
  label,
  icon: Icon,
  iconRight: IconRight,
  iconSize,
  loading = false,
  disabled = false,
  to = null,
  href = null,
  type = 'button',
  className = '',
  id,
  title,
  'aria-label': ariaLabelProp,
  onClick,
  ...rest
}, ref) => {
  const isSmall = size === 'small' || size === 'sm';
  const isIconSm = size === 'icon-sm' || size === 'icon-small';
  const isIconReg = size === 'icon' || size === 'icon-regular';

  // Determine size CSS class and default icon dimensions
  let sizeClass = 'btn-regular';
  let defaultIconPx = 14;
  if (isIconSm) {
    sizeClass = 'btn-icon-small';
    defaultIconPx = 12;
  } else if (isIconReg) {
    sizeClass = 'btn-icon-regular';
    defaultIconPx = 14;
  } else if (isSmall) {
    sizeClass = 'btn-small';
    defaultIconPx = 12;
  }

  // Determine variant CSS class
  let variantClass = 'btn-secondary';
  if (variant === 'primary') {
    variantClass = 'btn-primary';
  } else if (variant === 'danger-soft' || variant === 'danger') {
    variantClass = 'btn-danger-soft';
  } else if (variant === 'danger-solid') {
    variantClass = 'btn-danger-solid';
  } else if (variant === 'ghost') {
    variantClass = 'btn-ghost';
  } else if (variant === 'outline') {
    variantClass = 'btn-outline';
  }

  const isDisabled = disabled || loading;
  const buttonLabel = label || children;
  const accessibleTitle = title || (typeof buttonLabel === 'string' ? buttonLabel : undefined);
  const accessibleAriaLabel = ariaLabelProp || accessibleTitle;

  const resolvedIconSize = iconSize || defaultIconPx;

  const content = (
    <>
      {loading ? (
        <span
          className="rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
          style={{ width: `${resolvedIconSize}px`, height: `${resolvedIconSize}px` }}
          aria-hidden="true"
        />
      ) : Icon ? (
        <Icon
          className="shrink-0"
          style={{ width: `${resolvedIconSize}px`, height: `${resolvedIconSize}px` }}
          aria-hidden="true"
        />
      ) : null}

      {buttonLabel && (
        <span className="leading-none whitespace-nowrap">{buttonLabel}</span>
      )}

      {!loading && IconRight && (
        <IconRight
          className="shrink-0"
          style={{ width: `${resolvedIconSize}px`, height: `${resolvedIconSize}px` }}
          aria-hidden="true"
        />
      )}
    </>
  );

  const fullClasses = `btn-base ${sizeClass} ${variantClass} ${isDisabled ? 'btn-disabled opacity-50 cursor-not-allowed pointer-events-none' : ''
    } ${className}`.trim();

  if (to && !isDisabled) {
    return (
      <Link
        ref={ref}
        to={to}
        id={id}
        title={accessibleTitle}
        aria-label={accessibleAriaLabel}
        className={fullClasses}
        onClick={onClick}
        {...rest}
      >
        {content}
      </Link>
    );
  }

  if (href && !isDisabled) {
    return (
      <a
        ref={ref}
        href={href}
        id={id}
        title={accessibleTitle}
        aria-label={accessibleAriaLabel}
        className={fullClasses}
        onClick={onClick}
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      id={id}
      title={accessibleTitle}
      aria-label={accessibleAriaLabel}
      disabled={isDisabled}
      className={fullClasses}
      onClick={onClick}
      {...rest}
    >
      {content}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;


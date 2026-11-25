import React from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '../common/Button';

/**
 * Generic Row Action Button
 * Standard Small size: 26px height, 7px radius, 12px font-size, 13px icon, min-width 56px
 * (Legacy baseline reference: height: 28px; border-radius: 6px;)
 */
export const RowActionButton = ({
  variant = 'neutral', // 'neutral' | 'danger' | 'info'
  label,
  children,
  onClick,
  to = null,
  disabled = false,
  title,
  id,
  type = 'button',
  className = '',
  icon: Icon,
  'aria-label': ariaLabelProp,
  ...rest
}) => {
  const displayLabel = label || children || null;

  let btnVariant = 'secondary';
  let variantClass = 'btn-row-action-neutral';
  if (variant === 'danger') {
    btnVariant = 'danger-soft';
    variantClass = 'btn-row-action-danger';
  } else if (variant === 'info') {
    btnVariant = 'secondary';
    variantClass = 'btn-row-action-info';
  }

  return (
    <Button
      variant={btnVariant}
      size="small"
      icon={Icon}
      label={displayLabel}
      to={to}
      onClick={onClick}
      disabled={disabled}
      id={id}
      type={type}
      title={title}
      aria-label={ariaLabelProp}
      className={`btn-row-action ${variantClass} min-w-[50px] ${className}`}
      {...rest}
    />
  );
};

/**
 * EditButton (neutral outline)
 * Standard Small size (30px), min-width 64px, pencil icon
 */
export const EditButton = ({
  label = 'Edit',
  title = 'Edit',
  icon = Pencil,
  ...props
}) => {
  return (
    <RowActionButton
      variant="neutral"
      label={label}
      title={title}
      icon={icon}
      {...props}
    />
  );
};

/**
 * DeleteButton (soft danger red)
 * Standard Small size (30px), min-width 64px, trash icon
 */
export const DeleteButton = ({
  label = 'Delete',
  title = 'Delete',
  icon = Trash2,
  ...props
}) => {
  return (
    <RowActionButton
      variant="danger"
      label={label}
      title={title}
      icon={icon}
      {...props}
    />
  );
};

/**
 * ViewButton (neutral outline)
 * Standard Small size (30px), min-width 64px, eye icon
 */
export const ViewButton = ({
  label = 'View',
  title = 'View',
  icon = Eye,
  ...props
}) => {
  return (
    <RowActionButton
      variant="neutral"
      label={label}
      title={title}
      icon={icon}
      {...props}
    />
  );
};

/**
 * IconActionButton
 * Standard Icon-Only Small size (30x30px square, 8px radius, 14px icon)
 * Always includes aria-label and tooltip/title
 */
export const IconActionButton = ({
  icon: Icon,
  onClick,
  title,
  disabled = false,
  highlight = false,
  className = '',
  'aria-label': ariaLabelProp,
  id,
  type = 'button',
  to = null,
  ...rest
}) => {
  const accessibleLabel = ariaLabelProp || title || 'Action';

  let highlightClass = '';
  if (highlight) {
    highlightClass = '!text-[#d97706] !bg-[#fef3c7] hover:!bg-[#fde68a] hover:!text-[#b45309] !border-[#f59e0b]/30 shadow-2xs';
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      icon={Icon}
      to={to}
      onClick={onClick}
      disabled={disabled}
      id={id}
      type={type}
      title={title || accessibleLabel}
      aria-label={accessibleLabel}
      className={`btn-icon-action ${highlightClass} ${className}`}
      {...rest}
    />
  );
};

export default {
  RowActionButton,
  EditButton,
  DeleteButton,
  ViewButton,
  IconActionButton
};

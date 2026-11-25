import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../common/Button';

/* Unified Button Scale: Regular 36px (legacy baseline: h-8 rounded-md px-3) */
export const AddButton = ({
  label = 'Add',
  children,
  onClick,
  to = null,
  disabled = false,
  loading = false,
  title,
  id,
  type = 'button',
  className = '',
  icon: Icon = Plus,
  ...rest
}) => {
  const displayLabel = label || children || 'Add';

  return (
    <Button
      variant="primary"
      size="regular"
      icon={Icon}
      label={displayLabel}
      to={to}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      id={id}
      type={type}
      title={title}
      className={`btn-unified-add ${className}`}
      {...rest}
    />
  );
};

export default AddButton;

import React from 'react';
import { Download, Printer, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from './Button';

/**
 * Shared Export Button Component
 * Standard Regular size: 36px height, 14px padding, 10px radius, 13.5px font-weight 600, secondary white outline style
 * (Legacy baseline: height 32px, rounded 6px, px 12px)
 */
export const ExportButton = ({
  label,
  children,
  onClick,
  to = null,
  loading = false,
  disabled = false,
  format = 'csv', // 'csv' | 'excel' | 'pdf' | 'print'
  title,
  id,
  type = 'button',
  className = '',
  icon: customIcon = null,
  'aria-label': ariaLabelProp,
  ...rest
}) => {
  const defaultLabel = format === 'print' ? 'Print Report' : 'Export CSV';
  const displayLabel = label || children || defaultLabel;

  // Resolve appropriate icon based on format
  const getFormatIcon = () => {
    if (customIcon) return customIcon;
    switch (format?.toLowerCase()) {
      case 'print':
        return Printer;
      case 'pdf':
        return FileText;
      case 'excel':
      case 'xlsx':
        return FileSpreadsheet;
      case 'csv':
      default:
        return Download;
    }
  };

  const Icon = getFormatIcon();

  return (
    <Button
      variant="secondary"
      size="regular"
      icon={Icon}
      iconSize={14}
      label={displayLabel}
      to={to}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      id={id}
      type={type}
      title={title}
      aria-label={ariaLabelProp}
      className={`btn-unified-export ${className}`}
      {...rest}
    />
  );
};

export default ExportButton;

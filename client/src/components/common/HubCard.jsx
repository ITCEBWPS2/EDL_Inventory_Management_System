import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';

export const HubCard = ({
  id,
  title,
  description,
  icon: Icon,
  to,
  meta,
  actionText = 'Open',
  onClick,
  onEdit,
  onDelete,
  editTooltip = 'Edit category',
  deleteTooltip = 'Delete category',
  disabled = false,
  className = ''
}) => {
  const content = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Top-left rounded icon tile with soft maroon background and action buttons */}
        <div className="flex items-start justify-between gap-2 mb-4">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-[rgba(123,28,62,0.08)] border border-[rgba(123,28,62,0.15)] flex items-center justify-center text-[#7B1C3E] group-hover:bg-[rgba(123,28,62,0.14)] transition-colors shrink-0 shadow-2xs">
              <Icon className="w-5 h-5" />
            </div>
          )}

          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  type="button"
                  id={id ? `btn-edit-${id}` : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(e);
                  }}
                  className="w-[26px] h-[26px] flex items-center justify-center text-slate hover:text-signal hover:bg-surface rounded transition-all cursor-pointer"
                  title={editTooltip}
                  aria-label={editTooltip}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  id={id ? `btn-delete-${id}` : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(e);
                  }}
                  className="w-[26px] h-[26px] flex items-center justify-center text-slate hover:text-[#B4483A] hover:bg-[rgba(180,72,58,0.08)] rounded transition-all cursor-pointer"
                  title={deleteTooltip}
                  aria-label={deleteTooltip}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dark Title */}
        <h2 className="text-base font-semibold text-[#1B1B24] group-hover:text-[#7B1C3E] transition-colors tracking-tight">
          {title}
        </h2>

        {/* Grey Description (#4A4D5A, max 2 lines) */}
        {description && (
          <p className="text-xs text-[#4A4D5A] mt-2 leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Optional Meta text */}
        {meta && !description?.includes(meta) && (
          <div className="text-[11px] font-medium text-[#4A4D5A] mt-1.5">
            {meta}
          </div>
        )}
      </div>

      {/* Visible divider and maroon action link with moving arrow */}
      <div className="mt-5 pt-3.5 border-t border-[rgba(27,27,36,0.10)] flex items-center justify-between text-xs font-semibold text-[#7B1C3E] text-[#7a1a3c]">
        <span className="flex items-center gap-1.5">
          <span>{actionText}</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#7B1C3E] group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0 transition-transform" />
        </span>
      </div>
    </div>
  );

  const baseClasses = `content-card content-card-interactive p-6 flex flex-col justify-between group ${className}`;

  if (to && !disabled) {
    return (
      <Link
        to={to}
        id={id}
        aria-label={`${title} - Open`}
        onClick={onClick}
        className={baseClasses}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      id={id}
      role="button"
      tabIndex={0}
      aria-label={`${title} - Open`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e);
        }
      }}
      className={baseClasses}
    >
      {content}
    </div>
  );
};

export default HubCard;


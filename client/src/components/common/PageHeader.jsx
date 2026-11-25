import React from 'react';

export const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  actions = null,
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 ${className}`}>
      <div>
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="w-8 h-8 rounded-lg bg-[rgba(123,28,62,0.08)] text-[#7a1a3c] border border-[rgba(123,28,62,0.15)] flex items-center justify-center shrink-0 shadow-2xs">
              <Icon className="w-4 h-4" />
            </span>
          )}
          <h1 className="text-xl font-bold text-ink tracking-tight">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-xs text-slate mt-1 font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;


import React from 'react';
import { Link } from 'react-router-dom';

export const Breadcrumb = ({ breadcrumbs = [] }) => {
  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  // Prepend Root Dashboard Crumb if not already present
  const rootCrumb = { label: 'Dashboard', path: '/' };
  const allCrumbs = breadcrumbs[0]?.label === 'Dashboard'
    ? breadcrumbs
    : [rootCrumb, ...breadcrumbs];

  const total = allCrumbs.length;
  const lastIndex = total - 1;

  return (
    <nav aria-label="Breadcrumb" className="w-full">
      <ol className="flex items-center flex-wrap gap-y-1 gap-x-1.5 list-none m-0 p-0 text-[11px] sm:text-xs text-[#4A4D5A]">
        {allCrumbs.map((crumb, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === lastIndex;

          return (
            <React.Fragment key={`${crumb.path || crumb.label}-${idx}`}>
              {/* Separator */}
              {!isFirst && (
                <li aria-hidden="true" className="text-[#8a7a80] select-none mx-0.5 shrink-0">
                  &gt;
                </li>
              )}

              {/* Crumb Item */}
              <li className="inline-flex items-center min-w-0">
                {isLast ? (
                  <span
                    aria-current="page"
                    className="font-semibold text-[#280818] truncate max-w-[160px] sm:max-w-[280px]"
                    title={crumb.label}
                  >
                    {crumb.label}
                  </span>
                ) : crumb.path ? (
                  <Link
                    to={crumb.path}
                    className="hover:text-[#280818] hover:text-[#7a1a3c] font-medium text-[#4A4D5A] transition-colors truncate max-w-[140px] sm:max-w-[220px]"
                    title={crumb.label}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className="font-medium text-[#4A4D5A] truncate max-w-[140px] sm:max-w-[220px]"
                    title={crumb.label}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;

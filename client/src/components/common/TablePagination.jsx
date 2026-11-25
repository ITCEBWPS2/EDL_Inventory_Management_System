import React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from './Button';

/**
 * Shared Table Pagination Component (EDL IMS)
 *
 * Provides a standardized bottom footer pagination bar:
 * - Left: "Showing X-Y of Z items" (or "Showing all Z items")
 * - Center / Right:
 *   - "Rows per page" dropdown (25 / 50 / 100 / 200)
 *   - Pager buttons: Prev, numbered pages with current highlighted (maroon fill), ellipsis, Next
 *   - "Show all" / "Paginate" toggle button
 * - Keyboard accessible (aria-label, aria-current="page")
 * - Responsive: stacks on tablet/mobile, compact "Page X of Y" on tiny screens (<= 390px)
 * - Sticky bottom container support for tables
 */
export const TablePagination = ({
  totalItems = 0,
  page = 1,
  pageSize = 100,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
  showAll = false,
  onToggleShowAll,
  itemLabel = 'items',
  scrollToRef = null,
  className = '',
  id = 'table-pagination'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === safePage) return;
    if (onPageChange) {
      onPageChange(newPage);
    }
    // Smoothly scroll to top of table or container if ref provided
    if (scrollToRef && scrollToRef.current) {
      scrollToRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Generate page numbers with ellipsis for long lists
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  };

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  const infoText = showAll
    ? `Showing all ${totalItems.toLocaleString()} ${itemLabel}`
    : totalItems === 0
      ? `0 ${itemLabel}`
      : `Showing ${startItem.toLocaleString()}-${endItem.toLocaleString()} of ${totalItems.toLocaleString()} ${itemLabel}`;

  return (
    <div
      id={id}
      className={`sticky bottom-0 z-10 bg-white border-t border-[rgba(27,27,36,0.08)] px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#4A4D5A] select-none no-print ${className}`}
    >
      {/* Left: Info Text */}
      <div className="font-medium text-[#4A4D5A] shrink-0 text-center sm:text-left">
        {infoText}
      </div>

      {/* Right / Center Controls */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
        {/* Rows per page selector */}
        {onPageSizeChange && !showAll && totalItems > (pageSizeOptions[0] || 25) && (
          <div className="flex items-center gap-1.5 mr-1">
            <span className="text-[11px] text-[#5F6270] hidden md:inline">Rows per page:</span>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  onPageSizeChange(newSize);
                  if (onPageChange) onPageChange(1);
                }}
                className="h-[26px] appearance-none pl-2 pr-6 bg-white border border-[rgba(27,27,36,0.18)] rounded-[6px] text-xs font-medium text-[#1B1B24] focus:outline-none focus:ring-1 focus:ring-[#7B1C3E] cursor-pointer"
                aria-label="Rows per page"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[#5F6270] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Pager controls */}
        {!showAll && totalPages > 1 && (
          <nav aria-label="Table Pagination" className="flex items-center gap-1">
            {/* Prev button */}
            <Button
              size="small"
              variant="secondary"
              icon={ChevronLeft}
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Previous page"
              title="Previous page"
              className="!h-[26px] !px-2 !min-w-[26px]"
            />

            {/* Desktop page numbers */}
            <div className="hidden sm:flex items-center gap-1">
              {getPageNumbers().map((item, idx) => {
                if (item === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-[#5F6270] font-bold select-none">
                      &hellip;
                    </span>
                  );
                }
                const isCurrent = item === safePage;
                return (
                  <button
                    key={`page-${item}`}
                    type="button"
                    onClick={() => handlePageChange(item)}
                    aria-label={`Page ${item}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`h-[26px] min-w-[26px] px-2 rounded-[6px] text-xs font-semibold transition-all duration-150 ${isCurrent
                        ? 'bg-[#7B1C3E] text-white shadow-2xs font-bold border border-[#7B1C3E]'
                        : 'bg-white text-[#1B1B24] border border-[rgba(27,27,36,0.18)] hover:bg-[#fbf6f1] hover:border-[#7B1C3E]/50'
                      }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Mobile simplified page indicator */}
            <span className="sm:hidden px-2 text-xs font-medium text-[#1B1B24] tabular-nums">
              Page {safePage} of {totalPages}
            </span>

            {/* Next button */}
            <Button
              size="small"
              variant="secondary"
              icon={ChevronRight}
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage >= totalPages}
              aria-label="Next page"
              title="Next page"
              className="!h-[26px] !px-2 !min-w-[26px]"
            />
          </nav>
        )}

        {/* Toggle Show All / Paginate */}
        {onToggleShowAll && totalItems > (pageSizeOptions[0] || 25) && (
          <Button
            size="small"
            variant="ghost"
            onClick={onToggleShowAll}
            label={showAll ? `Paginate (${pageSize}/page)` : 'Show all'}
            title={showAll ? 'Enable page by page view' : 'Display all records on one screen'}
            className="!h-[26px] !text-xs !text-[#7B1C3E] hover:!bg-[#7B1C3E]/[0.06] font-semibold ml-1"
          />
        )}
      </div>
    </div>
  );
};

export default TablePagination;


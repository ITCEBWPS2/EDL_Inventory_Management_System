import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Filter, X, Info, Eye } from 'lucide-react';
import { Button } from './Button';
import { EditButton, DeleteButton, IconActionButton } from './ActionButtons';
import { TablePagination } from './TablePagination';
import { formatDate } from '../../utils/formatters';

export const TransactionsTable = ({
  transactions = [],
  paginatedData = [],
  loading = false,
  canWrite = false,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  // Filters & search
  selectedVoucherFilter = '',
  onVoucherFilterChange,
  selectedDateFilter = '',
  onDateFilterChange,
  selectedItemFilter = '',
  onItemFilterChange,
  searchQuery = '',
  onSearchQueryChange,
  distinctVouchers = [],
  distinctDates = [],
  hasNoDateRecords = false,
  distinctItems = [],
  onResetFilters,
  searchPlaceholder = 'Search voucher, date, item...',
  // Party column configuration
  partyColumnHeader = 'Party',
  partyField = 'from_whom',
  getPartyValue,
  onPartyClick,
  // Item name resolver
  getItemName,
  // Optional columns & actions
  hasImageColumn = false,
  onPreviewImage,
  onEdit,
  onDelete,
  emptyMessage = 'No records found.',
  emptySubMessage = 'Try adjusting your filter criteria or search query.'
}) => {
  const [detailModalItem, setDetailModalItem] = useState(null);

  const hasActiveFilters = Boolean(
    selectedVoucherFilter || selectedDateFilter || selectedItemFilter || searchQuery
  );

  const resolvePartyValue = (row) => {
    if (getPartyValue) return getPartyValue(row);
    if (partyField && row[partyField] !== undefined) return row[partyField];
    return row.from_whom || row.disposition || '';
  };

  const resolveItemDisplayName = (row) => {
    if (getItemName) return getItemName(row);
    return row.item_name || '—';
  };

  const hasExtraInfo = (row) => {
    return Boolean(
      (row.notes && row.notes.trim()) ||
      (row.description && row.description.trim()) ||
      (row.serial_number && row.serial_number.trim()) ||
      (Array.isArray(row.serial_numbers) && row.serial_numbers.length > 0)
    );
  };

  const getNotesText = (row) => {
    return row.notes || row.description || '';
  };

  const totalCols = hasImageColumn ? 9 : 8;

  return (
    <>
      <div className="bg-card rounded-xl border border-line shadow-card overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-line flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface/40">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Filter by Voucher No */}
            <div className="relative min-w-[145px]">
              <select
                id="select-voucher-filter"
                value={selectedVoucherFilter}
                onChange={(e) => onVoucherFilterChange?.(e.target.value)}
                className="w-full text-xs bg-card border border-line rounded py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                title="Filter by Voucher Number"
              >
                <option value="">All Vouchers</option>
                {distinctVouchers.map(vNo => (
                  <option key={vNo} value={vNo}>{vNo}</option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>

            {/* Filter by Date */}
            <div className="relative min-w-[135px]">
              <select
                id="select-date-filter"
                value={selectedDateFilter}
                onChange={(e) => onDateFilterChange?.(e.target.value)}
                className="w-full text-xs bg-card border border-line rounded py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                title="Filter by Transaction Date"
              >
                <option value="">All Dates</option>
                {hasNoDateRecords && <option value="__NO_DATE__">No Date (—)</option>}
                {distinctDates.map(date => (
                  <option key={date} value={date}>{formatDate(date)}</option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>

            {/* Filter by Item */}
            <div className="relative min-w-[145px]">
              <select
                id="select-item-filter"
                value={selectedItemFilter}
                onChange={(e) => onItemFilterChange?.(e.target.value)}
                className="w-full text-xs bg-card border border-line rounded py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                title="Filter by item type"
              >
                <option value="">All Items</option>
                {distinctItems.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>

            {/* Search Input Box */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input
                type="text"
                id="input-transaction-search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange?.(e.target.value)}
                className="w-full h-[30px] pl-9 pr-8 py-1 text-xs bg-card border border-line rounded-lg focus:outline-none focus:border-signal text-ink placeholder-slate shadow-subtle"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange?.('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate hover:text-ink p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="small"
                onClick={onResetFilters}
                className="text-[#B4483A] hover:text-[#912018]"
                title="Reset all filters"
                label="Reset filters"
              />
            )}
          </div>

          <div className="text-xs text-slate shrink-0">
            Showing <span className="font-semibold text-ink">{transactions.length}</span> records
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table
            className="w-full text-left text-xs text-ink border-collapse"
            style={{
              tableLayout: 'fixed',
              minWidth: hasImageColumn ? '1140px' : '1060px'
            }}
          >
            <colgroup>
              <col style={{ width: '56px', minWidth: '56px' }} />
              <col style={{ width: '110px', minWidth: '110px' }} />
              <col style={{ width: '130px', minWidth: '130px' }} />
              <col style={{ width: '240px', minWidth: '220px' }} />
              <col style={{ width: '90px', minWidth: '90px' }} />
              <col style={{ width: '180px', minWidth: '160px' }} />
              {hasImageColumn && <col style={{ width: '80px', minWidth: '80px' }} />}
              <col style={{ width: '70px', minWidth: '70px' }} />
              <col style={{ width: '190px', minWidth: '190px' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-line bg-white font-semibold text-slate uppercase tracking-[0.04em] text-[11.5px]">
                <th className="py-2.5 px-3 text-center" style={{ width: '56px', minWidth: '56px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>No.</th>
                <th className="py-2.5 px-3.5" style={{ width: '110px', minWidth: '110px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Date</th>
                <th className="py-2.5 px-3.5" style={{ width: '130px', minWidth: '130px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Voucher No.</th>
                <th className="py-2.5 px-3.5" style={{ width: '240px', minWidth: '220px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Item</th>
                <th className="py-2.5 px-3 text-center" style={{ width: '90px', minWidth: '90px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Quantity</th>
                <th className="py-2.5 px-3.5" style={{ width: '180px', minWidth: '160px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>{partyColumnHeader}</th>
                {hasImageColumn && (
                  <th className="py-2.5 px-3 text-center" style={{ width: '80px', minWidth: '80px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Image</th>
                )}
                <th className="py-2.5 px-3 text-center" style={{ width: '70px', minWidth: '70px', backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Info</th>
                <th className="py-2.5 px-3.5 text-right" style={{ width: '100px', minWidth: '100px', backgroundColor: '#ffffff', whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={totalCols} className="py-10 text-center text-slate">
                    <div className="inline-block w-6 h-6 border-2 border-line border-t-ink rounded-full animate-spin mb-2"></div>
                    <div>Loading transactions...</div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="py-10 text-center text-slate">
                    <div className="text-sm font-medium text-ink">{emptyMessage}</div>
                    <p className="text-xs mt-1 text-slate">{emptySubMessage}</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const dateDisplay = formatDate(row.date);
                  const partyVal = resolvePartyValue(row);
                  const itemName = resolveItemDisplayName(row);
                  const hasInfo = hasExtraInfo(row);

                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-surface/50 transition-colors group"
                    >
                      {/* 1. No */}
                      <td className="py-2 px-3 text-center text-slate font-mono font-medium">
                        {rowNumber}
                      </td>

                      {/* 2. Date */}
                      <td className="py-2 px-3.5 font-mono text-slate whitespace-nowrap">
                        {dateDisplay}
                      </td>

                      {/* 3. Voucher No */}
                      <td className="py-2 px-3.5 font-mono font-semibold text-ink whitespace-nowrap">
                        {row.voucher_no || '—'}
                      </td>

                      {/* 4. Item */}
                      <td className="py-2 px-3.5">
                        <div className="font-semibold text-ink leading-tight">
                          {itemName}
                        </div>
                      </td>

                      {/* 5. Qty (dark rounded pill) */}
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ink text-white min-w-[22px] tabular-nums">
                          {row.quantity}
                        </span>
                      </td>

                      {/* 6. Party column (From Whom Received / To Whom Issued: dark maroon text #7B1C3E, hover:underline) */}
                      <td className="py-2 px-3.5">
                        {partyVal && partyVal.trim() && partyVal !== '—' ? (
                          <span
                            onClick={() => {
                              if (onPartyClick) {
                                onPartyClick(partyVal.trim());
                              } else if (onSearchQueryChange) {
                                onSearchQueryChange(partyVal.trim());
                              }
                            }}
                            className="text-[#7B1C3E] hover:underline font-medium cursor-pointer transition-colors"
                            title={`Click to filter by ${partyColumnHeader.toLowerCase()}`}
                          >
                            {partyVal.trim()}
                          </span>
                        ) : (
                          <span className="text-slate/60 font-mono">—</span>
                        )}
                      </td>

                      {/* 7. Image (optional column for Received) */}
                      {hasImageColumn && (
                        <td className="py-2 px-3 text-center">
                          {row.voucher_url ? (
                            <button
                              type="button"
                              onClick={() => onPreviewImage?.(row.voucher_url)}
                              className="inline-flex items-center justify-center p-0.5 rounded border border-line hover:border-signal transition-colors group/img cursor-pointer"
                              title="Click to preview voucher image"
                            >
                              <img
                                src={row.voucher_url}
                                alt="Voucher"
                                className="w-6 h-6 object-cover rounded"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.nextSibling) {
                                    e.currentTarget.nextSibling.style.display = 'inline-flex';
                                  }
                                }}
                              />
                              <span className="hidden w-6 h-6 rounded bg-surface items-center justify-center text-signal">
                                <Eye className="w-3.5 h-3.5" />
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate/50 font-mono text-sm">—</span>
                          )}
                        </td>
                      )}

                      {/* 8. Info (ⓘ icon, opens details popover) */}
                      <td className="py-2 px-3 text-center">
                        <IconActionButton
                          icon={Info}
                          highlight={hasInfo}
                          disabled={!hasInfo}
                          onClick={hasInfo ? () => setDetailModalItem(row) : undefined}
                          title={hasInfo ? `Details: ${getNotesText(row)} ${row.serial_number ? `(SN: ${row.serial_number})` : ''}`.trim() : 'No additional information'}
                          aria-label={hasInfo ? `Details for ${row.voucher_no || itemName || 'record'}` : 'No additional information'}
                        />
                      </td>

                      {/* 9. Actions (Edit & Delete in compact row-button size) */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap w-[100px] align-top">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          {onEdit && (
                            <EditButton
                              onClick={() => onEdit?.(row, idx)}
                              title="Edit"
                              aria-label={`Edit ${row.voucher_no || itemName || 'record'}`}
                            />
                          )}
                          {onDelete && (
                            <DeleteButton
                              onClick={() => onDelete?.(row)}
                              title="Delete"
                              aria-label={`Delete ${row.voucher_no || itemName || 'record'}`}
                            />
                          )}
                          {!onEdit && !onDelete && (
                            <span className="text-slate/40 text-xs italic">Read only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {transactions.length > pageSize && (
          <TablePagination
            totalItems={transactions.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={onPageChange}
            itemLabel="records"
            className="border-t border-line bg-surface/30"
          />
        )}
      </div>

      {/* Details Modal */}
      {detailModalItem && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto no-print animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailModalItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-xl border border-line shadow-modal w-full max-w-md max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] overflow-y-auto p-6 space-y-4 text-xs m-auto shrink-0 animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-signal" />
                <h3 className="text-sm font-semibold text-ink">
                  Transaction Details {detailModalItem.voucher_no?.trim() ? `(${detailModalItem.voucher_no})` : ''}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                icon={X}
                onClick={() => setDetailModalItem(null)}
                aria-label="Close details"
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">Voucher No.:</span>
                <span className="font-mono text-ink text-right font-semibold">{detailModalItem.voucher_no?.trim() || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">Date:</span>
                <span className="font-mono text-ink text-right">{formatDate(detailModalItem.date)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">Item:</span>
                <span className="font-semibold text-ink text-right">{resolveItemDisplayName(detailModalItem)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">Quantity:</span>
                <span className="font-bold text-ink text-right tabular-nums">{detailModalItem.quantity}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">{partyColumnHeader}:</span>
                <span className="font-medium text-ink text-right">{resolvePartyValue(detailModalItem) || '—'}</span>
              </div>
              {detailModalItem.serial_number && (
                <div className="flex justify-between py-1 border-b border-line/50">
                  <span className="text-slate">Serial Number:</span>
                  <span className="font-mono text-ink text-right">{detailModalItem.serial_number}</span>
                </div>
              )}
              {getNotesText(detailModalItem) && (
                <div className="pt-2">
                  <span className="text-slate block mb-1 font-medium">Description / Notes:</span>
                  <p className="p-2.5 bg-surface rounded-lg border border-line text-ink leading-relaxed break-words whitespace-pre-wrap">
                    {getNotesText(detailModalItem)}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="secondary"
                size="small"
                label="Close"
                onClick={() => setDetailModalItem(null)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};


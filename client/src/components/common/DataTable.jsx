import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, Filter, Edit2, Trash2, ChevronLeft, ChevronRight, ChevronDown, Printer } from 'lucide-react';
import { EditButton, DeleteButton } from '../ui/ActionButtons';
import { Button } from './Button';
import { TablePagination } from './TablePagination';
import { IndeterminateCheckbox } from './IndeterminateCheckbox';
import { PrintLabelsActionBar } from '../inventory/PrintLabelsActionBar';
import { PrintLabelsModal } from '../inventory/PrintLabelsModal';
import {
  getItemSerials,
  isItemSelectable,
  getBatchSelectionStatus,
  toggleBatchSerials,
  toggleSingleSerial,
  selectAllFilteredSerials,
  resolvePrintItems
} from '../../utils/selectionHelper';
import { isBatchItem } from '../../utils/serialNumberGenerator';
import { getBatchSerialList } from '../inventory/BatchSerialSubTable';

export const DataTable = ({
  columns = [],
  data = [],
  onAdd = null,
  onEdit = null,
  onDelete = null,
  deleteTooltip = 'Delete',
  isRowDeletable = null,
  hideDisabledDelete = false,
  addLabel = 'Add New',
  filterOptions = [],
  filterKey = null,
  onFilterChange = null,
  searchFieldOptions = [],
  searchPlaceholder = 'Search records...',
  loading = false,
  emptyMessage = 'No records found',
  renderExpandedRow = null,
  isRowExpandable = null,
  expandColumn = false,
  enableSerialSelection = false // Enable serial label selection & printing
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [selectedSearchField, setSelectedSearchField] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState({});
  const pageSize = 10;

  // Serial Label Selection State (persists across search/filter and pagination)
  const [selectedSerials, setSelectedSerials] = useState(() => new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [modalPrintItems, setModalPrintItems] = useState(null); // Items passed to PrintLabelsModal

  const toggleRowExpand = (key) => {
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const checkRowExpandable = (row) => {
    if (isRowExpandable) return isRowExpandable(row);
    return Boolean(
      row.is_batch ||
      (Array.isArray(row.serial_numbers) && row.serial_numbers.length > 1) ||
      Number(row.quantity) > 1
    );
  };

  // Local filtering
  const filteredData = useMemo(() => {
    return data.filter(row => {
      // Filter by dropdown
      if (selectedFilter && filterKey) {
        if (filterKey === 'type') {
          const typeVal = String(row.sub_classification || row.item_name || '').toLowerCase();
          if (typeVal !== selectedFilter.toLowerCase()) return false;
        } else if (row[filterKey] !== selectedFilter) {
          return false;
        }
      }
      // Search query
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        if (selectedSearchField && selectedSearchField !== 'all') {
          if (selectedSearchField === 'type') {
            const typeVal = String(row.sub_classification || row.item_name || '').toLowerCase();
            if (!typeVal.includes(q)) return false;
          } else if (selectedSearchField === 'item_code') {
            const codeVal = String(row.item_code || '').toLowerCase();
            const batchLabel = String(row.batch_label || '').toLowerCase();
            const serialMatch = Array.isArray(row.serial_numbers) && row.serial_numbers.some(s => String(s).toLowerCase().includes(q));
            if (!codeVal.includes(q) && !batchLabel.includes(q) && !serialMatch) return false;
          } else {
            const val = String(row[selectedSearchField] || '').toLowerCase();
            if (!val.includes(q)) return false;
          }
        } else {
          const hasMatch = Object.values(row).some(val =>
            val && String(val).toLowerCase().includes(q)
          ) || (row.batch_label && String(row.batch_label).toLowerCase().includes(q))
            || (Array.isArray(row.serial_numbers) && row.serial_numbers.some(s => String(s).toLowerCase().includes(q)));
          if (!hasMatch) return false;
        }
      }
      return true;
    });
  }, [data, selectedFilter, filterKey, searchTerm, selectedSearchField]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    return filteredData.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  }, [filteredData, safeCurrentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Lookup map for serial -> { itemName, itemId }
  const serialMetadataMap = useMemo(() => {
    const map = new Map();
    (data || []).forEach(item => {
      const serials = getItemSerials(item);
      const itemName = item.sub_classification || item.item_name || '';
      serials.forEach(s => {
        map.set(s, { itemName, itemId: item.id });
      });
    });
    return map;
  }, [data]);

  // Collect all valid serial numbers in the current filtered data
  const totalFilteredSerialsCount = useMemo(() => {
    if (!enableSerialSelection) return 0;
    return filteredData.reduce((acc, row) => acc + getItemSerials(row).length, 0);
  }, [filteredData, enableSerialSelection]);

  // Current page serial selection status
  const { isCurrentPageAllSelected, isCurrentPageSomeSelected } = useMemo(() => {
    if (!enableSerialSelection || paginatedData.length === 0) {
      return { isCurrentPageAllSelected: false, isCurrentPageSomeSelected: false };
    }
    const pageSerials = paginatedData.flatMap(row => getItemSerials(row));
    if (pageSerials.length === 0) {
      return { isCurrentPageAllSelected: false, isCurrentPageSomeSelected: false };
    }
    let count = 0;
    for (const s of pageSerials) {
      if (selectedSerials.has(s)) count++;
    }
    return {
      isCurrentPageAllSelected: count === pageSerials.length,
      isCurrentPageSomeSelected: count > 0
    };
  }, [enableSerialSelection, paginatedData, selectedSerials]);

  // Handlers for selection
  const handleTogglePageSelection = () => {
    const pageSerials = paginatedData.flatMap(row => getItemSerials(row));
    if (pageSerials.length === 0) return;

    setSelectedSerials(prev => {
      const next = new Set(prev);
      if (isCurrentPageAllSelected) {
        // Deselect all on current page
        pageSerials.forEach(s => next.delete(s));
      } else {
        // Select all on current page
        pageSerials.forEach(s => next.add(s));
      }
      return next;
    });
  };

  const handleToggleSingleSerial = (serial) => {
    setSelectedSerials(prev => toggleSingleSerial(serial, prev));
  };

  const handleToggleBatchRow = (item) => {
    setSelectedSerials(prev => toggleBatchSerials(item, prev));
  };

  const handleRowCheckboxChange = (row, globalIdx, event) => {
    const serials = getItemSerials(row);
    if (!serials.length) return;

    const isShiftKey = event?.nativeEvent?.shiftKey || false;

    if (isShiftKey && lastClickedIndex !== null && lastClickedIndex !== globalIdx) {
      // Range selection
      const start = Math.min(lastClickedIndex, globalIdx);
      const end = Math.max(lastClickedIndex, globalIdx);
      const rangeRows = filteredData.slice(start, end + 1);

      setSelectedSerials(prev => {
        const next = new Set(prev);
        // Determine whether target is now being checked
        const targetStatus = getBatchSelectionStatus(row, prev);
        const shouldSelect = targetStatus !== 'checked';

        rangeRows.forEach(r => {
          const rSerials = getItemSerials(r);
          rSerials.forEach(s => {
            if (shouldSelect) next.add(s);
            else next.delete(s);
          });
        });
        return next;
      });
    } else {
      // Single row toggle
      setSelectedSerials(prev => toggleBatchSerials(row, prev));
    }
    setLastClickedIndex(globalIdx);
  };

  const handleSelectAllFiltered = () => {
    setSelectedSerials(prev => selectAllFilteredSerials(filteredData, prev));
  };

  const handleClearSelection = () => {
    setSelectedSerials(new Set());
    setLastClickedIndex(null);
  };

  const handleOpenPrintModal = (itemsToPrint = null) => {
    if (itemsToPrint && itemsToPrint.length > 0) {
      setModalPrintItems(itemsToPrint);
    } else {
      const resolved = resolvePrintItems(data, selectedSerials, serialMetadataMap);
      setModalPrintItems(resolved);
    }
  };

  const handlePrintSingle = (row) => {
    const serial = row.item_code?.trim();
    if (!serial) return;
    setModalPrintItems([{
      serial,
      itemName: row.sub_classification || row.item_name || '',
      itemId: row.id
    }]);
  };

  const handlePrintBatch = (row) => {
    const serials = getBatchSerialList(row);
    const itemName = row.sub_classification || row.item_name || '';
    setModalPrintItems(serials.map(s => ({
      serial: s,
      itemName,
      itemId: row.id
    })));
  };

  // Dynamic placeholder based on selected search field
  const activeSearchFieldLabel = searchFieldOptions.find(o => o.value === selectedSearchField)?.label;
  const dynamicPlaceholder = selectedSearchField === 'item_code'
    ? 'Search by Serial No...'
    : selectedSearchField === 'type'
      ? `Search by ${activeSearchFieldLabel || 'Type'}...`
      : searchPlaceholder;

  const showActionsColumn = Boolean(onEdit || onDelete || enableSerialSelection);
  const actionsColWidth = enableSerialSelection ? 200 : (onEdit && onDelete ? 100 : 70);
  const totalColSpan = columns.length + (expandColumn ? 1 : 0) + (enableSerialSelection ? 1 : 0) + (showActionsColumn ? 1 : 0);

  // Helper to resolve clean, collapse-proof column widths
  const resolveColWidth = (col) => {
    if (typeof col.width === 'number') return col.width;
    if (typeof col.width === 'string' && col.width.endsWith('px')) {
      const parsed = parseInt(col.width, 10);
      if (!isNaN(parsed)) return parsed;
    }
    const h = (typeof col.header === 'string' ? col.header : '').toLowerCase();
    const a = (typeof col.accessor === 'string' ? col.accessor : '').toLowerCase();
    if (h === 'no.' || h === 'no' || a === '_seq_no' || a === 'index') return 56;
    if (h.includes('serial no') || a === 'item_code') return 400;
    if (h.includes('manufacturer') || a === 'serial_number') return 150;
    if (h.includes('type') || a === 'sub_classification') return 170;
    if (h.includes('category') || a === 'category') return 170;
    if (h.includes('brand') || a === 'brand') return 130;
    if (h.includes('description') || h.includes('item name') || a === 'description' || a === 'item_name') return 220;
    if (h.includes('quantity') || h === 'qty' || a === 'quantity') return 90;
    if (h.includes('unit') || h.includes('location') || a === 'unit_name' || a === 'location') return 120;
    if (h.includes('status') || a === 'status' || a === 'account_status') return 110;
    return 140;
  };

  const resolveColMinWidth = (col) => {
    if (typeof col.minWidth === 'number') return col.minWidth;
    if (typeof col.minWidth === 'string' && col.minWidth.endsWith('px')) {
      const parsed = parseInt(col.minWidth, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return resolveColWidth(col);
  };

  const totalTableMinWidth =
    (enableSerialSelection ? 44 : 0) +
    (expandColumn ? 40 : 0) +
    columns.reduce((sum, col) => sum + resolveColMinWidth(col), 0) +
    (showActionsColumn ? actionsColWidth : 0);

  return (
    <div className="relative content-card bg-card rounded-xl border border-line shadow-card overflow-hidden">
      {/* Top Filter & Search Bar */}
      <div className="p-4 border-b border-[rgba(27,27,36,0.10)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/70 no-print">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          {/* Search box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input
              type="text"
              placeholder={dynamicPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 h-[30px] text-xs bg-card border border-line rounded-lg focus:outline-none focus:border-[#7a1a3c] focus:ring-1 focus:ring-[#7a1a3c]/30 text-ink placeholder-slate shadow-subtle transition-all"
            />
          </div>

          {/* Search Field Filter Dropdown */}
          {searchFieldOptions.length > 0 && (
            <div className="relative">
              <select
                id="search-by-field-select"
                value={selectedSearchField}
                onChange={(e) => {
                  setSelectedSearchField(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-[30px] text-xs bg-card border border-line rounded-lg px-2.5 pr-7 appearance-none focus:outline-none focus:border-[#7a1a3c] focus:ring-1 focus:ring-[#7a1a3c]/30 text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                title="Filter search by field"
              >
                {searchFieldOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>
          )}

          {/* Optional Filter Dropdown */}
          {filterOptions.length > 0 && (
            <div className="relative">
              <select
                value={selectedFilter}
                onChange={(e) => {
                  setSelectedFilter(e.target.value);
                  if (onFilterChange) onFilterChange(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-[30px] text-xs bg-card border border-line rounded-lg px-2.5 pr-7 appearance-none focus:outline-none focus:border-[#7a1a3c] focus:ring-1 focus:ring-[#7a1a3c]/30 text-ink font-medium shadow-subtle cursor-pointer"
              >
                <option value="">All Categories / Units</option>
                {filterOptions.map(opt => (
                  <option key={opt.value || opt} value={opt.value || opt}>
                    {opt.label || opt}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>
          )}
        </div>

        <div className="text-xs text-slate shrink-0">
          Showing <span className="font-semibold text-ink tabular-nums">{filteredData.length}</span> records
        </div>
      </div>

      {/* Table Container with Horizontal Scrolling */}
      <div className="overflow-x-auto w-full min-h-[300px]">
        <table
          className="w-full text-left border-collapse"
          style={{
            tableLayout: 'fixed',
            minWidth: `${totalTableMinWidth}px`
          }}
        >
          <colgroup>
            {enableSerialSelection && (
              <col style={{ width: '44px', minWidth: '44px' }} />
            )}
            {expandColumn && (
              <col style={{ width: '40px', minWidth: '40px' }} />
            )}
            {columns.map((col, idx) => {
              const w = resolveColWidth(col);
              const minW = resolveColMinWidth(col);
              return <col key={idx} style={{ width: `${w}px`, minWidth: `${minW}px` }} />;
            })}
            {showActionsColumn && (
              <col style={{ width: `${actionsColWidth}px`, minWidth: `${actionsColWidth}px` }} />
            )}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-[rgba(27,27,36,0.10)] bg-white text-[11.5px] font-semibold text-[#4A4D5A] tracking-[0.04em] uppercase">
              {/* Checkbox Column */}
              {enableSerialSelection && (
                <th
                  className="py-2.5 px-3 text-center shrink-0"
                  style={{
                    width: '44px',
                    minWidth: '44px',
                    backgroundColor: '#ffffff',
                    verticalAlign: 'bottom',
                    padding: '10px 12px'
                  }}
                >
                  <IndeterminateCheckbox
                    checked={isCurrentPageAllSelected}
                    indeterminate={isCurrentPageSomeSelected && !isCurrentPageAllSelected}
                    onChange={handleTogglePageSelection}
                    title={isCurrentPageAllSelected ? 'Deselect all on this page' : 'Select all on this page'}
                    aria-label="Select all on this page"
                  />
                </th>
              )}

              {expandColumn && (
                <th
                  className="py-2.5 px-2 text-center"
                  style={{
                    width: '40px',
                    minWidth: '40px',
                    backgroundColor: '#ffffff',
                    verticalAlign: 'bottom',
                    padding: '10px 12px'
                  }}
                ></th>
              )}

              {columns.map((col, idx) => {
                const w = resolveColWidth(col);
                const minW = resolveColMinWidth(col);
                return (
                  <th
                    key={idx}
                    style={{
                      width: `${w}px`,
                      minWidth: `${minW}px`,
                      backgroundColor: '#ffffff',
                      whiteSpace: 'normal',
                      wordBreak: 'normal',
                      overflowWrap: 'normal',
                      hyphens: 'none',
                      lineHeight: 1.25,
                      padding: '10px 12px',
                      verticalAlign: 'bottom',
                      fontSize: '11.5px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase'
                    }}
                    className={`font-semibold text-[#4A4D5A] ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                    title={col.title || (typeof col.header === 'string' ? col.header : undefined)}
                  >
                    {col.header}
                  </th>
                );
              })}

              {showActionsColumn && (
                <th
                  style={{
                    width: `${actionsColWidth}px`,
                    minWidth: `${actionsColWidth}px`,
                    backgroundColor: '#ffffff',
                    whiteSpace: 'nowrap',
                    wordBreak: 'normal',
                    overflowWrap: 'normal',
                    hyphens: 'none',
                    lineHeight: 1.25,
                    padding: '10px 12px',
                    verticalAlign: 'bottom',
                    fontSize: '11.5px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}
                  className="font-semibold text-[#4A4D5A] text-right"
                >
                  ACTIONS
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-xs text-ink">
            {loading ? (
              <tr>
                <td colSpan={totalColSpan} className="py-10 text-center text-slate">
                  <div className="inline-block w-6 h-6 border-2 border-slate/30 border-t-ink rounded-full animate-spin mb-2"></div>
                  <div>Loading operational records...</div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={totalColSpan} className="py-10 text-center text-slate">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => {
                const globalRowIdx = (safeCurrentPage - 1) * pageSize + rowIdx;
                const rowKey = row.id || `row-${rowIdx}`;
                const canExpand = renderExpandedRow && checkRowExpandable(row);
                const isExpanded = Boolean(expandedRows[rowKey]);
                const isBatch = Boolean(checkRowExpandable(row));
                const batchStatus = enableSerialSelection
                  ? getBatchSelectionStatus(row, selectedSerials)
                  : 'unchecked';
                const isRowChecked = batchStatus === 'checked';

                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className={`hover:bg-surface/60 transition-colors group ${isExpanded ? 'bg-surface/40' : ''
                        } ${isRowChecked ? 'bg-signal/5' : ''}`}
                    >
                      {/* Checkbox Cell */}
                      {enableSerialSelection && (
                        <td className="py-2.5 px-3 text-center shrink-0 w-10 align-top">
                          <IndeterminateCheckbox
                            checked={isRowChecked}
                            indeterminate={batchStatus === 'indeterminate'}
                            disabled={batchStatus === 'disabled'}
                            title={
                              batchStatus === 'disabled'
                                ? 'No serial number assigned'
                                : isBatch
                                  ? 'Select all batch serials'
                                  : 'Select serial'
                            }
                            aria-label={`Select item ${row.item_name || row.item_code}`}
                            onChange={(e) => handleRowCheckboxChange(row, globalRowIdx, e)}
                          />
                        </td>
                      )}

                      {expandColumn && (
                        <td className="py-2.5 px-2 text-center shrink-0 w-10 align-top">
                          {canExpand ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(rowKey);
                              }}
                              className={`w-[26px] h-[26px] rounded-[7px] hover:bg-surface text-slate hover:text-signal transition-transform duration-150 inline-flex items-center justify-center ${isExpanded ? 'rotate-90 text-signal font-bold' : ''
                                }`}
                              title={isExpanded ? 'Collapse batch serials' : 'Expand batch serials'}
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="w-4 inline-block" />
                          )}
                        </td>
                      )}

                      {columns.map((col, colIdx) => (
                        <td
                          key={colIdx}
                          className={`py-2.5 px-3.5 align-top ${col.tabular ? 'tabular-nums' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                        >
                          {col.render
                            ? col.render(row, globalRowIdx, {
                              isExpanded,
                              toggleExpand: () => toggleRowExpand(rowKey),
                              canExpand
                            })
                            : row[col.accessor]}
                        </td>
                      ))}

                      {showActionsColumn && (
                        <td
                          style={{ width: `${actionsColWidth}px`, minWidth: `${actionsColWidth}px` }}
                          className="py-2.5 px-3.5 text-right shrink-0 whitespace-nowrap align-top"
                        >
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {/* Print Label(s) Button */}
                            {enableSerialSelection && (
                              isBatch ? (
                                <Button
                                  variant="secondary"
                                  size="small"
                                  onClick={() => handlePrintBatch(row)}
                                  title="Print all labels for this batch"
                                  aria-label="Print all labels for this batch"
                                  icon={Printer}
                                  label={<span className="hidden sm:inline">Print Batch</span>}
                                />
                              ) : row.item_code?.trim() ? (
                                <Button
                                  variant="secondary"
                                  size="small"
                                  onClick={() => handlePrintSingle(row)}
                                  title="Print serial label"
                                  aria-label="Print serial label"
                                  icon={Printer}
                                  label={<span className="hidden sm:inline">Print Label</span>}
                                />
                              ) : null
                            )}

                            {onEdit && (
                              <EditButton
                                onClick={() => onEdit(row)}
                                title="Edit"
                                aria-label={`Edit ${row.item_name || row.full_name || row.unit_name || 'item'}`}
                              />
                            )}

                            {onDelete && (() => {
                              const canDelete = isRowDeletable ? isRowDeletable(row) : true;
                              if (!canDelete) {
                                if (hideDisabledDelete) return null;
                                return (
                                  <DeleteButton
                                    disabled
                                    title="You cannot delete this item"
                                    aria-label="Cannot delete item"
                                  />
                                );
                              }
                              const tooltipText = typeof deleteTooltip === 'function' ? deleteTooltip(row) : deleteTooltip;
                              return (
                                <DeleteButton
                                  onClick={() => onDelete(row)}
                                  title={tooltipText || 'Delete'}
                                  aria-label={`${tooltipText || 'Delete'} ${row.item_name || row.full_name || row.unit_name || 'item'}`}
                                />
                              );
                            })()}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Sub-table rendered when expanded */}
                    {canExpand && isExpanded && (
                      <tr className="bg-surface/20 border-b border-line">
                        <td colSpan={totalColSpan} className="py-3 px-4 sm:px-8">
                          {(() => {
                            const rendered = renderExpandedRow(row, {
                              collapse: () => toggleRowExpand(rowKey),
                              isExpanded: true,
                              selectedSerials: enableSerialSelection ? selectedSerials : null,
                              onToggleSerial: handleToggleSingleSerial,
                              onPrintSerial: handleOpenPrintModal,
                              onToggleAllBatchSerials: handleToggleBatchRow
                            });

                            if (React.isValidElement(rendered)) {
                              return React.cloneElement(rendered, {
                                selectedSerials: enableSerialSelection ? selectedSerials : null,
                                onToggleSerial: handleToggleSingleSerial,
                                onPrintSerial: handleOpenPrintModal,
                                onToggleAllBatchSerials: handleToggleBatchRow
                              });
                            }
                            return rendered;
                          })()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <TablePagination
          totalItems={filteredData.length}
          page={safeCurrentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          className="border-t border-line bg-surface/40"
        />
      )}

      {/* Sticky Action Bar */}
      {enableSerialSelection && (
        <PrintLabelsActionBar
          selectedCount={selectedSerials.size}
          totalFilteredCount={totalFilteredSerialsCount}
          onPrint={() => handleOpenPrintModal()}
          onClear={handleClearSelection}
          onSelectAllFiltered={handleSelectAllFiltered}
        />
      )}

      {/* Print Labels Modal */}
      {enableSerialSelection && (
        <PrintLabelsModal
          isOpen={modalPrintItems !== null}
          onClose={() => setModalPrintItems(null)}
          itemsToPrint={modalPrintItems || []}
        />
      )}
    </div>
  );
};

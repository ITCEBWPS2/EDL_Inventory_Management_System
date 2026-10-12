import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Edit2, Trash2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

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
  expandColumn = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [selectedSearchField, setSelectedSearchField] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState({});
  const pageSize = 10;

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
  const filteredData = data.filter(row => {
    // Filter by dropdown
    if (selectedFilter && filterKey && row[filterKey] !== selectedFilter) {
      return false;
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

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Dynamic placeholder based on selected search field
  const activeSearchFieldLabel = searchFieldOptions.find(o => o.value === selectedSearchField)?.label;
  const dynamicPlaceholder = selectedSearchField === 'item_code'
    ? 'Search by Serial No...'
    : selectedSearchField === 'type'
    ? `Search by ${activeSearchFieldLabel || 'Type'}...`
    : searchPlaceholder;

  const totalColSpan = columns.length + (expandColumn ? 1 : 0) + ((onEdit || onDelete) ? 1 : 0);

  return (
    <div className="relative bg-card rounded-xl border border-line shadow-card overflow-hidden">
      {/* Top Filter & Search Bar */}
      <div className="p-4 border-b border-line flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface/50">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          {/* Search box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input
              type="text"
              placeholder={dynamicPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate shadow-subtle"
            />
          </div>

          {/* Search Field Filter Dropdown (e.g. All Fields / Item Code / Chair Type) */}
          {searchFieldOptions.length > 0 && (
            <div className="relative">
              <select
                id="search-by-field-select"
                value={selectedSearchField}
                onChange={(e) => {
                  setSelectedSearchField(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-card border border-line rounded py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                title="Filter search by field"
              >
                {searchFieldOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
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
                className="text-xs bg-card border border-line rounded py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer"
              >
                <option value="">All Categories / Units</option>
                {filterOptions.map(opt => (
                  <option key={opt.value || opt} value={opt.value || opt}>
                    {opt.label || opt}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>
          )}
        </div>

        <div className="text-xs text-slate shrink-0">
          Showing <span className="font-semibold text-ink tabular-nums">{filteredData.length}</span> records
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto w-full min-h-[300px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface/80 text-[11px] font-semibold text-slate tracking-wider uppercase">
              {expandColumn && (
                <th className="py-3 px-2 w-10 text-center"></th>
              )}
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`py-3 px-4 ${idx === 0 && !expandColumn ? 'sticky-col bg-surface/90' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.header}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="py-3 px-4 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-xs text-ink">
            {loading ? (
              <tr>
                <td colSpan={totalColSpan} className="py-12 text-center text-slate">
                  <div className="inline-block w-6 h-6 border-2 border-slate/30 border-t-ink rounded-full animate-spin mb-2"></div>
                  <div>Loading operational records...</div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={totalColSpan} className="py-12 text-center text-slate">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => {
                const rowKey = row.id || `row-${rowIdx}`;
                const canExpand = renderExpandedRow && checkRowExpandable(row);
                const isExpanded = Boolean(expandedRows[rowKey]);

                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className={`hover:bg-surface/60 transition-colors group ${
                        isExpanded ? 'bg-surface/40' : ''
                      }`}
                    >
                      {expandColumn && (
                        <td className="py-3 px-2 text-center shrink-0 w-10">
                          {canExpand ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(rowKey);
                              }}
                              className={`p-1 rounded hover:bg-surface text-slate hover:text-signal transition-transform duration-150 inline-flex items-center justify-center ${
                                isExpanded ? 'rotate-90 text-signal font-bold' : ''
                              }`}
                              title={isExpanded ? 'Collapse batch serials' : 'Expand batch serials'}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="w-4 inline-block" />
                          )}
                        </td>
                      )}
                      {columns.map((col, colIdx) => (
                        <td
                          key={colIdx}
                          className={`py-3 px-4 ${
                            colIdx === 0 && !renderExpandedRow ? 'sticky-col bg-card group-hover:bg-surface/90 font-medium' : ''
                          } ${col.tabular ? 'tabular-nums' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                        >
                          {col.render
                            ? col.render(row, (currentPage - 1) * pageSize + rowIdx, {
                                isExpanded,
                                toggleExpand: () => toggleRowExpand(rowKey),
                                canExpand
                              })
                            : row[col.accessor]}
                        </td>
                      ))}
                      {(onEdit || onDelete) && (
                        <td className="py-3 px-4 text-right shrink-0 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {onEdit && (
                              <button
                                onClick={() => onEdit(row)}
                                title="Edit"
                                className="p-1.5 rounded hover:bg-surface text-slate hover:text-ink transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDelete && (() => {
                              const canDelete = isRowDeletable ? isRowDeletable(row) : true;
                              if (!canDelete) {
                                if (hideDisabledDelete) return null;
                                return (
                                  <button
                                    type="button"
                                    disabled
                                    aria-disabled="true"
                                    title="You cannot delete your own account"
                                    className="p-1.5 rounded text-slate/30 cursor-not-allowed opacity-40"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                );
                              }
                              const tooltipText = typeof deleteTooltip === 'function' ? deleteTooltip(row) : deleteTooltip;
                              return (
                                <button
                                  type="button"
                                  onClick={() => onDelete(row)}
                                  title={tooltipText || 'Delete'}
                                  className="p-1.5 rounded hover:bg-[#B4483A]/10 text-[#B4483A] hover:text-[#96382C] transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
                          {renderExpandedRow(row, {
                            collapse: () => toggleRowExpand(rowKey),
                            isExpanded: true
                          })}
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
      <div className="p-3 border-t border-line flex items-center justify-between text-xs text-slate bg-surface/40">
        <div>
          Page <span className="font-semibold text-ink tabular-nums">{safeCurrentPage}</span> of{' '}
          <span className="font-semibold text-ink tabular-nums">{totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safeCurrentPage === 1}
            className="p-1.5 rounded border border-line bg-card hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded border border-line bg-card hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};

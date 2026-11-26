import React from 'react';
import { PrintHeader } from '../common/PrintHeader';
import { formatDate } from '../../utils/formatters';

/**
 * PrintableCountSheet
 * Renders the blank physical verification count sheet for A4 Landscape printing.
 * Hidden on screen; styled for exact printing to paper or PDF.
 */
export const PrintableCountSheet = ({
  countSheetData,
  metadata = {}
}) => {
  if (!countSheetData) return null;

  const { options, items, groups, totalItems, totalSystemQty } = countSheetData;
  const unitName = metadata.unitName || 'All Units';
  const rawDate = metadata.date || '';
  const dateFormatted = rawDate ? formatDate(rawDate) : '';
  const yearStr = metadata.year || new Date().getFullYear().toString();
  const verifier1 = metadata.verifier1 || '';
  const verifier2 = metadata.verifier2 || '';
  const verifier3 = metadata.verifier3 || '';

  const showSystemQty = Boolean(options.showSystemQty);
  const groupByCategory = Boolean(options.groupByCategory);
  const prefill = Boolean(options.prefillHeader);

  // Column definitions with width percentages summing to 100%
  // Optimized for A4 landscape (~277mm printable width) with generous Remarks space
  const columns = [];
  if (groupByCategory) {
    columns.push({ key: 'no', label: 'No.', width: '3%', align: 'center' });
    columns.push({ key: 'serial', label: 'Serial No.', width: showSystemQty ? '23%' : '24%', align: 'left' });
    columns.push({ key: 'item', label: 'Item', width: showSystemQty ? '15%' : '16%', align: 'left' });
    if (showSystemQty) {
      columns.push({ key: 'sys_qty', label: 'System\nQty', width: '4.5%', align: 'center' });
    }
    columns.push({ key: 'phys_qty', label: 'Physical\nQty', width: showSystemQty ? '5.5%' : '6%', align: 'center' });
    columns.push({ key: 'diff', label: 'Diff.', width: showSystemQty ? '4.5%' : '5%', align: 'center' });
    columns.push({ key: 'cond', label: 'Condition', width: '7%', align: 'center' });
    columns.push({ key: 'issued', label: 'Issued /\nDestroyed', width: '7.5%', align: 'center' });
    columns.push({ key: 'label', label: 'Verification\nLabel No.', width: showSystemQty ? '8%' : '8.5%', align: 'center' });
    columns.push({ key: 'remarks', label: 'Remarks', width: showSystemQty ? '22%' : '23%', align: 'left' });
  } else {
    columns.push({ key: 'no', label: 'No.', width: '3%', align: 'center' });
    columns.push({ key: 'serial', label: 'Serial No.', width: showSystemQty ? '20%' : '21%', align: 'left' });
    columns.push({ key: 'item', label: 'Item', width: showSystemQty ? '13%' : '14%', align: 'left' });
    columns.push({ key: 'category', label: 'Category', width: showSystemQty ? '9%' : '9.5%', align: 'left' });
    if (showSystemQty) {
      columns.push({ key: 'sys_qty', label: 'System\nQty', width: '4.5%', align: 'center' });
    }
    columns.push({ key: 'phys_qty', label: 'Physical\nQty', width: showSystemQty ? '5.5%' : '6%', align: 'center' });
    columns.push({ key: 'diff', label: 'Diff.', width: showSystemQty ? '4.5%' : '5%', align: 'center' });
    columns.push({ key: 'cond', label: 'Condition', width: '7%', align: 'center' });
    columns.push({ key: 'issued', label: 'Issued /\nDestroyed', width: showSystemQty ? '7%' : '7.5%', align: 'center' });
    columns.push({ key: 'label', label: 'Verification\nLabel No.', width: '8.5%', align: 'center' });
    columns.push({ key: 'remarks', label: 'Remarks', width: showSystemQty ? '18%' : '18.5%', align: 'left' });
  }

  const totalCols = columns.length;

  let rowCounter = 1;

  return (
    <div
      id="verification-count-sheet-print-area"
      className="hidden print:block text-black bg-white font-sans text-[8.5pt] leading-tight w-full"
      style={{
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        boxSizing: 'border-box'
      }}
    >
      {/* 1. Standard EDL Print Header */}
      <div className="mb-2.5">
        <PrintHeader
          reportTitle=""
          unitOverride={unitName}
        />
      </div>

      {/* 2. Document Title */}
      <div className="text-center mb-3">
        <h1 className="text-[13pt] font-bold tracking-tight text-black uppercase">
          Annual Physical Verification — Count Sheet
        </h1>
        <p className="text-[8pt] text-gray-600 mt-0.5">
          Official form for physical count recording. Complete by hand and return to store verifiers.
        </p>
      </div>

      {/* 3. Form Handwriting Fields Block */}
      <div className="border border-black/80 rounded p-2 mb-3 text-[9pt] bg-gray-50/50">
        {/* Row 1: Location, Date, Year */}
        <div className="grid grid-cols-3 gap-4 pb-2 border-b border-black/20">
          <div>
            <span className="font-bold">Location:</span>{' '}
            <span className="font-medium underline decoration-black/40 underline-offset-4">{unitName}</span>
          </div>
          <div>
            <span className="font-bold">Date:</span>{' '}
            {prefill && dateFormatted ? (
              <span className="font-semibold underline decoration-black/40 underline-offset-4">{dateFormatted}</span>
            ) : (
              <span className="font-mono text-gray-700 tracking-wider">____ / ____ / ________</span>
            )}
          </div>
          <div>
            <span className="font-bold">Year:</span>{' '}
            <span className="font-semibold underline decoration-black/40 underline-offset-4">{yearStr}</span>
          </div>
        </div>

        {/* Row 2: Verified by 1, 2, 3 */}
        <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="font-bold shrink-0">Verified by:</span>
          <div className="flex-1 flex flex-wrap items-center gap-4 text-[8.5pt]">
            <div className="flex-1 min-w-[140px]">
              <span className="font-semibold text-gray-700">1) </span>
              {prefill && verifier1 ? (
                <span className="font-medium underline decoration-black/40 underline-offset-2">{verifier1}</span>
              ) : (
                <span className="inline-block w-40 border-b border-black/60 translate-y-[-2px]">&nbsp;</span>
              )}
            </div>
            <div className="flex-1 min-w-[140px]">
              <span className="font-semibold text-gray-700">2) </span>
              {prefill && verifier2 ? (
                <span className="font-medium underline decoration-black/40 underline-offset-2">{verifier2}</span>
              ) : (
                <span className="inline-block w-40 border-b border-black/60 translate-y-[-2px]">&nbsp;</span>
              )}
            </div>
            <div className="flex-1 min-w-[140px]">
              <span className="font-semibold text-gray-700">3) </span>
              {prefill && verifier3 ? (
                <span className="font-medium underline decoration-black/40 underline-offset-2">{verifier3}</span>
              ) : (
                <span className="inline-block w-40 border-b border-black/60 translate-y-[-2px]">&nbsp;</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Count Sheet Table */}
      <table
        className="w-full border-collapse border border-black table-fixed text-[8pt]"
        style={{
          borderCollapse: 'collapse',
          borderSpacing: 0,
          breakInside: 'auto'
        }}
      >
        {/* Table Column Header: Repeats on every page */}
        <thead
          style={{
            display: 'table-header-group',
            breakInside: 'avoid'
          }}
        >
          <tr className="bg-gray-100 text-black border-b border-black font-bold uppercase tracking-wider text-[7.5pt]">
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  border: '0.5pt solid #000000',
                  padding: '3px 4px',
                  verticalAlign: 'bottom',
                  textAlign: col.align,
                  whiteSpace: 'pre-line',
                  lineHeight: '1.15'
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {groupByCategory && groups && groups.length > 0 ? (
            groups.map(group => (
              <React.Fragment key={group.category}>
                {/* Category Group Header Row */}
                <tr
                  className="bg-gray-200/90 text-black font-bold"
                  style={{
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                    breakAfter: 'avoid',
                    pageBreakAfter: 'avoid'
                  }}
                >
                  <td
                    colSpan={totalCols}
                    style={{
                      border: '0.5pt solid #000000',
                      padding: '4px 6px',
                      fontSize: '8.5pt',
                      backgroundColor: '#e5e7eb'
                    }}
                  >
                    CATEGORY: {group.category.toUpperCase()} ({group.items.length} items)
                  </td>
                </tr>

                {/* Items in this category */}
                {group.items.map(item => (
                  <CountSheetItemRow
                    key={item.id}
                    item={item}
                    index={rowCounter++}
                    showSystemQty={showSystemQty}
                    groupByCategory={groupByCategory}
                  />
                ))}
              </React.Fragment>
            ))
          ) : (
            items.map(item => (
              <CountSheetItemRow
                key={item.id}
                item={item}
                index={rowCounter++}
                showSystemQty={showSystemQty}
                groupByCategory={groupByCategory}
              />
            ))
          )}
        </tbody>
      </table>

      {/* 5. Totals Line */}
      <div
        className="mt-2.5 py-1.5 px-2 border border-black font-bold flex justify-between items-center text-[8.5pt] bg-gray-50"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        <div>
          Total Items Listed:{' '}
          <span className="font-mono text-[9pt]">{totalItems}</span>
        </div>
        {showSystemQty && (
          <div>
            Total System Quantity:{' '}
            <span className="font-mono text-[9pt]">{totalSystemQty}</span>
          </div>
        )}
      </div>

      {/* 6. Signature Block */}
      {options.includeSignatureBlock && (
        <div
          className="mt-4 pt-2 border-t-2 border-black/80"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <div className="grid grid-cols-3 gap-6 text-[8pt] mb-3">
            <div>
              <div className="font-semibold text-gray-800 mb-1">Verifier 1 Signature:</div>
              <div className="border-b border-black h-7">&nbsp;</div>
              <div className="mt-1 text-[7.5pt] text-gray-600">Date: ________________________</div>
            </div>
            <div>
              <div className="font-semibold text-gray-800 mb-1">Verifier 2 Signature:</div>
              <div className="border-b border-black h-7">&nbsp;</div>
              <div className="mt-1 text-[7.5pt] text-gray-600">Date: ________________________</div>
            </div>
            <div>
              <div className="font-semibold text-gray-800 mb-1">Verifier 3 Signature:</div>
              <div className="border-b border-black h-7">&nbsp;</div>
              <div className="mt-1 text-[7.5pt] text-gray-600">Date: ________________________</div>
            </div>
          </div>

          <div className="border-t border-black/30 pt-2 flex items-center justify-between text-[8.5pt]">
            <div className="flex items-center gap-2">
              <span className="font-bold">Verified by Unit Head:</span>
              <span className="inline-block w-64 border-b border-black">&nbsp;</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">Date:</span>
              <span className="inline-block w-36 border-b border-black">&nbsp;</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Printed Running Footer fallback */}
      <div
        className="mt-3 pt-1 border-t border-gray-400 flex justify-between items-center text-[7pt] text-gray-600"
        style={{ breakInside: 'avoid' }}
      >
        <span>
          EDL IMS — Annual Verification Count Sheet — {unitName} — {dateFormatted || formatDate(new Date())}
        </span>
        <span>A4 Landscape • Confidential Store Verification Document</span>
      </div>
    </div>
  );
};

/**
 * Individual row component for the count sheet table.
 */
const CountSheetItemRow = ({ item, index, showSystemQty, groupByCategory }) => {
  const isPending = item.is_pending_condemnation;
  const serials = Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
    ? item.serial_numbers
    : (item.primary_serial && item.primary_serial !== '—' ? [item.primary_serial] : []);

  return (
    <tr
      style={{
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        minHeight: '9mm'
      }}
      className="border-b border-black"
    >
      {/* 1. No. */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'center',
          verticalAlign: 'top',
          fontFamily: 'monospace'
        }}
      >
        {index}
      </td>

      {/* 2. Serial No. (Each serial on its OWN line, monospace 8pt, never wrapped) */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'left',
          verticalAlign: 'top',
          fontFamily: 'monospace',
          fontSize: '7.5pt',
          lineHeight: '1.25',
          whiteSpace: 'pre-line',
          wordBreak: 'break-all'
        }}
      >
        {serials.length > 0 ? (
          serials.map((sn, sIdx) => (
            <div key={sIdx} className="leading-tight">
              {sn}
            </div>
          ))
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      {/* 3. Item Name */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'left',
          verticalAlign: 'top',
          lineHeight: '1.2'
        }}
      >
        <div className="font-semibold text-[8pt] text-black">
          {item.item_name || '—'}
        </div>
        {isPending && (
          <div className="text-[6.5pt] italic text-red-700 font-medium mt-0.5">
            (Pending condemnation)
          </div>
        )}
      </td>

      {/* 4. Category (only if not grouped) */}
      {!groupByCategory && (
        <td
          style={{
            border: '0.5pt solid #000000',
            padding: '3px 4px',
            textAlign: 'left',
            verticalAlign: 'top',
            fontSize: '7.5pt'
          }}
        >
          {item.category || 'General'}
        </td>
      )}

      {/* 5. System Qty (optional) */}
      {showSystemQty && (
        <td
          style={{
            border: '0.5pt solid #000000',
            padding: '3px 4px',
            textAlign: 'center',
            verticalAlign: 'top',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            fontSize: '8.5pt'
          }}
        >
          {item.system_qty}
        </td>
      )}

      {/* 6. Physical Qty (Empty box for handwriting) */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'center',
          verticalAlign: 'top'
        }}
      >
        &nbsp;
      </td>

      {/* 7. Difference (Empty box for handwriting) */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'center',
          verticalAlign: 'top'
        }}
      >
        &nbsp;
      </td>

      {/* 8. Condition (Empty box for handwriting) */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'center',
          verticalAlign: 'top'
        }}
      >
        &nbsp;
      </td>

      {/* 9. Issued / Destroyed (Empty box for handwriting) */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'center',
          verticalAlign: 'top'
        }}
      >
        &nbsp;
      </td>

      {/* 10. Verification Label No. (Empty box for handwriting) */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'center',
          verticalAlign: 'top'
        }}
      >
        &nbsp;
      </td>

      {/* 11. Remarks (Empty box for handwriting) */}
      <td
        style={{
          border: '0.5pt solid #000000',
          padding: '3px 4px',
          textAlign: 'left',
          verticalAlign: 'top'
        }}
      >
        &nbsp;
      </td>
    </tr>
  );
};

export default PrintableCountSheet;

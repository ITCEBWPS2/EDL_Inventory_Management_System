import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { BackButton } from '../components/common/BackButton';
import { formatDate, exportToCSV } from '../utils/formatters';
import { SerialNumberCell } from '../components/verification/SerialNumberCell';
import { Download, Printer, Plus, ChevronDown } from 'lucide-react';
import { PrintHeader } from '../components/common/PrintHeader';
import { AddButton } from '../components/ui/AddButton';
import { ExportButton } from '../components/ui/ExportButton';

export const VerificationHistory = () => {
  const { selectedUnitId, selectedUnit, canWrite } = useAuth();
  const toast = useToast();

  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('2026');
  const [expandedRemarks, setExpandedRemarks] = useState({});
  const [expandedLabels, setExpandedLabels] = useState({});

  const toggleRemark = (rowKey) => {
    setExpandedRemarks(prev => ({
      ...prev,
      [rowKey]: !prev[rowKey]
    }));
  };

  const toggleLabel = (rowKey) => {
    setExpandedLabels(prev => ({
      ...prev,
      [rowKey]: !prev[rowKey]
    }));
  };

  // Load verified history items
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedUnitId) params.unit_id = selectedUnitId;
      if (selectedYear && selectedYear !== 'All') params.year = selectedYear;

      // Primary: query flattened verified history items endpoint
      const res = await api.get('/verifications/history-items', params);
      if (res.success && Array.isArray(res.data)) {
        setHistoryItems(res.data);
      } else {
        // Fallback: query verifications list and flatten items
        const verifRes = await api.get('/verifications', params);
        if (verifRes.success && Array.isArray(verifRes.data)) {
          const rows = [];
          verifRes.data
            .filter(v => v.status === 'confirmed')
            .sort((a, b) => {
              const dateDiff = new Date(b.date || 0) - new Date(a.date || 0);
              if (dateDiff !== 0) return dateDiff;
              return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            })
            .forEach(v => {
              const vNames = [v.verifier_1, v.verifier_2, v.verifier_3].filter(Boolean);
              const verifiersDisplay = vNames.length > 0
                ? vNames.join(', ')
                : (Array.isArray(v.verified_by) ? v.verified_by.join(', ') : (v.verified_by || ''));

              const items = v.items || [];
              items.forEach(item => {
                const sysQty = Number(item.system_qty || 0);
                const hasPhys = item.physical_qty !== null && item.physical_qty !== undefined && item.physical_qty !== '' && !isNaN(Number(item.physical_qty));
                const physQty = hasPhys ? Number(item.physical_qty) : null;
                const physAvail = physQty;
                const physNotAvail = hasPhys ? Math.max(0, sysQty - physQty) : null;

                const hasCondition = Boolean(
                  item.condition &&
                  item.condition !== '—' &&
                  (item.condition !== 'Good' || hasPhys || (item.status && item.status !== 'Not Counted' && item.status !== 'Not counted'))
                );
                const rawDisp = item.issued_destroyed || item.disposition || '';
                const hasDisp = Boolean(
                  rawDisp &&
                  rawDisp !== '—' &&
                  rawDisp !== 'N/A' &&
                  String(rawDisp).trim() !== ''
                );
                const trimmedLabel = (item.label_no !== null && item.label_no !== undefined) ? String(item.label_no).trim() : '';
                const hasLabel = Boolean(trimmedLabel && trimmedLabel !== '—');
                const trimmedRemarks = (item.remarks || item.special_remarks || '').trim();
                const hasRemarks = Boolean(trimmedRemarks && trimmedRemarks !== '—');
                const isCountedStatus = item.status && item.status !== 'Not Counted' && item.status !== 'Not counted';

                const hasEnteredData = hasPhys || hasCondition || hasDisp || hasLabel || hasRemarks || isCountedStatus;

                if (!hasEnteredData) {
                  return;
                }

                const itemSerials = (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0)
                  ? item.serial_numbers
                  : (item.item_code ? [item.item_code] : []);
                const itemMfgSerials = (Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.length > 0)
                  ? item.manufacturer_serial_numbers
                  : (item.manufacturer_sn ? [item.manufacturer_sn] : []);

                rows.push({
                  id: item.id,
                  verification_id: v.id,
                  year: v.year,
                  unit_id: v.unit_id,
                  unit_name: v.unit_name || 'Unknown Unit',
                  date: v.date,
                  verified_by: verifiersDisplay,
                  item_code: item.item_code || '',
                  serial_numbers: itemSerials,
                  manufacturer_serial_numbers: itemMfgSerials,
                  is_batch: item.is_batch ?? itemSerials.length > 1,
                  item_name: item.item_name || '',
                  category: item.category || '',
                  in_inventory: item.in_inventory !== false,
                  system_qty: sysQty,
                  physical_available: physAvail,
                  physical_not_available: physNotAvail,
                  difference: hasPhys ? physQty - sysQty : 0,
                  condition: (item.condition && item.condition !== '—') ? item.condition : (hasEnteredData ? 'Good' : '—'),
                  disposition: hasDisp ? rawDisp : '—',
                  issued_destroyed: hasDisp ? rawDisp : '—',
                  issued_destroyed_id: item.issued_destroyed_id || null,
                  issued_destroyed_qty: item.issued_destroyed_qty || null,
                  remarks: hasRemarks ? trimmedRemarks : '—',
                  label_no: hasLabel ? trimmedLabel : '—',
                  is_counted: hasEnteredData,
                  status: !hasEnteredData ? 'Not counted' : (item.status || 'Counted')
                });
              });
            });
          setHistoryItems(rows);
        }
      }
    } catch (err) {
      console.error('Failed to load verification history:', err);
      toast.error('Failed to load verification history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedUnitId, selectedYear]);

  // Distinct years available for dropdown
  const availableYears = useMemo(() => {
    return ['2026', '2025', '2024', 'All'];
  }, []);

  // Filtered rows for display
  const displayItems = useMemo(() => {
    if (selectedYear === 'All') return historyItems;
    return historyItems.filter(item => String(item.year) === String(selectedYear));
  }, [historyItems, selectedYear]);

  // Verification item counts for grouping header subtitles
  const verificationCounts = useMemo(() => {
    const map = {};
    displayItems.forEach(item => {
      const vid = item.verification_id;
      if (vid) {
        map[vid] = (map[vid] || 0) + 1;
      }
    });
    return map;
  }, [displayItems]);

  // Export to CSV
  const handleExport = () => {
    if (!displayItems.length) {
      toast.error('No verification records available to export.');
      return;
    }

    const exportData = displayItems.map((item, idx) => {
      const serialsStr = Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
        ? item.serial_numbers.join('; ')
        : (item.item_code || '—');

      const dispStr = item.disposition && item.disposition !== '—' && item.disposition !== 'N/A'
        ? (item.issued_destroyed_qty && Number(item.issued_destroyed_qty) > 1
            ? `${item.disposition} × ${item.issued_destroyed_qty}`
            : item.disposition)
        : '—';

      return {
        'No': idx + 1,
        'Year': item.year,
        'Serial No.': serialsStr,
        'Item': item.item_name || '—',
        'Category': item.category || '—',
        'Verification Date': formatDate(item.date),
        'Verified By': item.verified_by || '—',
        'In Inventory': item.in_inventory ? 'Yes' : 'No',
        'System Qty': item.system_qty,
        'Physical Available': item.physical_available !== null && item.physical_available !== undefined ? item.physical_available : '—',
        'Physical Not Available': item.physical_not_available !== null && item.physical_not_available !== undefined ? item.physical_not_available : '—',
        'Condition': item.condition && item.condition !== '—' ? item.condition : (!item.is_counted ? 'Not counted' : '—'),
        'Issued / Destroyed': dispStr,
        'Special Remarks': item.remarks && item.remarks !== '—' ? item.remarks : '—',
        'Verification Label No.': item.label_no && item.label_no !== '—' ? item.label_no : '—'
      };
    });

    exportToCSV(exportData, `EDL_Verification_History_${selectedYear}_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Verification history exported successfully.');
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/verification' },
        { label: 'Verification History' }
      ]}
    >
      <div className="print-landscape">
        {/* Printable Report Header */}
        <div className="hidden print:block mb-4">
          <PrintHeader
            reportTitle="Annual Verification History Archive"
            subtitle="Annual Board of Survey"
            filtersSummary={`Cycle Year: ${selectedYear} • Listed Records: ${displayItems.length}`}
            extraInfo={
              <div className="flex justify-between text-[11px]">
                <span><strong className="text-black">Form:</strong> EDL-IMS AUDIT FORM 04-H</span>
                <span><strong className="text-black">Cycle Year:</strong> {selectedYear}</span>
              </div>
            }
          />
        </div>

      {/* Header bar with Export, Print, and Add action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Verification History</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton
            onClick={handleExport}
            label="Export CSV"
            title="Export verification records as CSV"
          />
          <ExportButton
            format="print"
            label="Print Report"
            onClick={() => window.print()}
            title="Print Landscape Verification Archive"
          />
          {canWrite && (
            <AddButton
              to="/verification/new"
              id="btn-start-new-survey"
              label="Start New Survey"
            />
          )}
        </div>
      </div>

      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 no-print">
        {/* Left: Year dropdown + Include Not Counted checkbox + count pill badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none bg-card border border-line rounded-lg pl-4 pr-9 py-2 text-xs font-bold text-ink focus:outline-none focus:border-signal cursor-pointer shadow-subtle hover:bg-surface transition-colors"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Record count badge: black pill badge with white text */}
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-ink text-white shadow-xs">
            {displayItems.length} records
          </span>
        </div>
      </div>

      {/* Table: Plain table with table-fixed layout and controlled remarks wrapping */}
      <div className="bg-card border border-line rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] min-h-[340px] overflow-y-auto">
          <table className="min-w-full text-left text-xs text-ink border-collapse table-fixed print:table-auto print:min-w-0" style={{ minWidth: '2066px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '56px', minWidth: '56px' }} />
              <col style={{ width: '70px', minWidth: '70px' }} />
              <col style={{ width: '380px', minWidth: '380px' }} />
              <col style={{ width: '190px', minWidth: '190px' }} />
              <col style={{ width: '120px', minWidth: '120px' }} />
              <col style={{ width: '190px', minWidth: '190px' }} />
              <col style={{ width: '100px', minWidth: '100px' }} />
              <col style={{ width: '90px', minWidth: '90px' }} />
              <col style={{ width: '110px', minWidth: '110px' }} />
              <col style={{ width: '120px', minWidth: '120px' }} />
              <col style={{ width: '100px', minWidth: '100px' }} />
              <col style={{ width: '140px', minWidth: '140px' }} />
              <col style={{ width: '240px', minWidth: '240px' }} />
              <col style={{ width: '150px', minWidth: '150px' }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-white border-b border-line shadow-xs">
              <tr className="border-b border-line bg-white font-semibold text-slate uppercase tracking-wider text-[11px]">
                <th className="w-[56px] min-w-[56px] text-center" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>No.</th>
                <th className="w-[70px] min-w-[70px] text-center" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Year</th>
                <th className="w-[380px] min-w-[380px] text-left border-r border-line/60" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Serial No.</th>
                <th className="w-[190px] min-w-[190px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Item</th>
                <th className="w-[120px] min-w-[120px] text-left" title="Verification Date" aria-label="Verification Date" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Verification<br />Date</th>
                <th className="w-[190px] min-w-[190px] text-left" title="Verified By" aria-label="Verified By" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Verified<br />By</th>
                <th className="w-[100px] min-w-[100px] text-center" title="In Inventory" aria-label="In Inventory" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>In<br />Inventory</th>
                <th className="w-[90px] min-w-[90px] text-center" title="System Qty" aria-label="System Qty" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>System<br />Qty</th>
                <th className="w-[110px] min-w-[110px] text-center" title="Physical Available" aria-label="Physical Available" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Physical<br />Available</th>
                <th className="w-[120px] min-w-[120px] text-center" title="Physical Not Available" aria-label="Physical Not Available" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Physical Not<br />Available</th>
                <th className="w-[100px] min-w-[100px] text-center" title="Condition" aria-label="Condition" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Condition</th>
                <th className="w-[140px] min-w-[140px] text-center" title="Issued / Destroyed" aria-label="Issued / Destroyed" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Issued /<br />Destroyed</th>
                <th className="w-[240px] min-w-[240px] text-left" title="Special Remarks" aria-label="Special Remarks" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Special Remarks</th>
                <th className="w-[150px] min-w-[150px] text-center" title="Verification Label No." aria-label="Verification Label No." style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Verification<br />Label No.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate">
                    <div className="inline-block w-6 h-6 border-2 border-line border-t-ink rounded-full animate-spin mb-2"></div>
                    <div>Loading verification records...</div>
                  </td>
                </tr>
              ) : displayItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate">
                    <div className="text-sm font-medium text-ink">No verification records found for {selectedYear}.</div>
                    <p className="text-xs mt-1 text-slate">Confirmed annual surveys will appear here once finalized.</p>
                  </td>
                </tr>
              ) : (
                displayItems.map((item, idx) => {
                  const prevItem = idx > 0 ? displayItems[idx - 1] : null;
                  const isNewVerificationGroup = !prevItem || prevItem.verification_id !== item.verification_id;

                  const hasPhysAvail = item.physical_available !== null && item.physical_available !== undefined;
                  const hasPhysNotAvail = item.physical_not_available !== null && item.physical_not_available !== undefined;
                  const isNotAvailPos = hasPhysNotAvail && Number(item.physical_not_available) > 0;
                  const hasExcess = hasPhysAvail && Number(item.difference) > 0;

                  const condStr = (item.condition || '').toLowerCase();
                  const dispStr = (item.disposition || '').toLowerCase();

                  const rowKey = item.id || `row-${idx}`;
                  const isExpanded = Boolean(expandedRemarks[rowKey]);
                  const hasLongRemark = Boolean(
                    item.remarks &&
                    item.remarks !== '—' &&
                    (item.remarks.length > 85 || (item.remarks.match(/[,;\n]/g) || []).length >= 2)
                  );

                  const labelStr = (item.label_no && item.label_no !== '—') ? String(item.label_no).trim() : '';
                  const isLabelExpanded = Boolean(expandedLabels[rowKey]);
                  const isLongLabel = labelStr.length > 24;
                  const hasClampedLabel = isLongLabel && (labelStr.length > 45 || (labelStr.match(/[,;\n]/g) || []).length >= 2);

                  return (
                    <React.Fragment key={item.id || idx}>
                      {/* Verification group header row */}
                      {isNewVerificationGroup && (
                        <tr className="bg-surface/90 border-y border-line text-xs font-semibold text-ink">
                          <td colSpan={14} className="py-2 px-4 bg-[#F2F5F8] border-b border-line">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold text-ink">
                                  Verification {formatDate(item.date)}
                                </span>
                                <span className="text-slate/60">•</span>
                                <span className="text-slate text-[11px] font-medium">
                                  Verified by: <span className="text-ink font-semibold">{item.verified_by || '—'}</span>
                                </span>
                                {item.unit_name && (
                                  <>
                                    <span className="text-slate/60">•</span>
                                    <span className="text-slate text-[11px]">{item.unit_name}</span>
                                  </>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate font-medium">
                                {verificationCounts[item.verification_id] || 1} rows
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      <tr className="hover:bg-surface/50 transition-colors group">
                        {/* 1. No */}
                        <td className="py-2 px-3 text-center text-slate font-mono font-medium align-top w-[56px] min-w-[56px]">
                          {idx + 1}
                        </td>

                        {/* 2. Year */}
                        <td className="py-2 px-3 font-mono font-bold text-ink text-center whitespace-nowrap align-top w-[70px] min-w-[70px]">
                          {item.year}
                        </td>

                        {/* 3. Serial No. (min-w-[380px], single line per serial, collapse for batches) */}
                        <td className="py-2 px-3 min-w-[380px] w-[380px] align-top border-r border-line/60">
                          <SerialNumberCell
                            serialNumbers={item.serial_numbers}
                            manufacturerSerialNumbers={item.manufacturer_serial_numbers}
                            singleSerial={item.item_code}
                            singleMfg={item.manufacturer_sn}
                            resetTrigger={selectedYear}
                          />
                        </td>

                        {/* 4. Item */}
                        <td className="py-2 px-4 w-[190px] min-w-[190px] font-semibold text-ink leading-snug align-top whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word]">
                          <div className="whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word]">{item.item_name}</div>
                          {item.category && (
                            <div className="text-[10px] text-slate font-normal mt-0.5 whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word]">{item.category}</div>
                          )}
                        </td>

                        {/* 5. Verification Date */}
                        <td className="py-2 px-3 w-[120px] min-w-[120px] font-mono text-slate whitespace-nowrap align-top">
                          {formatDate(item.date)}
                        </td>

                        {/* 6. Verified By */}
                        <td className="py-2 px-4 w-[190px] min-w-[190px] text-slate leading-snug align-top whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word]">
                          {item.verified_by || '—'}
                        </td>

                        {/* 7. In Inventory */}
                        <td className="py-2 px-3 w-[100px] min-w-[100px] text-center whitespace-nowrap align-top">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.in_inventory !== false ? 'bg-ink text-white' : 'bg-slate/20 text-slate'
                          }`}>
                            {item.in_inventory !== false ? 'Yes' : 'No'}
                          </span>
                        </td>

                        {/* 8. System Qty */}
                        <td className="py-2 px-3 w-[90px] min-w-[90px] text-center font-bold text-ink font-mono text-sm align-top whitespace-nowrap">
                          {item.system_qty}
                        </td>

                        {/* 9. Physical Available */}
                        <td className="py-2 px-3 w-[110px] min-w-[110px] text-center align-top whitespace-nowrap">
                          {hasPhysAvail ? (
                            <div>
                              <span className="font-mono font-bold text-[#2F7A5C] text-sm">
                                {item.physical_available}
                              </span>
                              {hasExcess && (
                                <div className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded mt-0.5 inline-block">
                                  +{item.difference} excess
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate font-normal">—</span>
                          )}
                        </td>

                        {/* 10. Physical Not Available */}
                        <td className="py-2 px-3 w-[120px] min-w-[120px] text-center font-mono font-bold text-sm align-top whitespace-nowrap">
                          {hasPhysNotAvail ? (
                            <span className={isNotAvailPos ? 'text-[#B4483A]' : 'text-slate'}>
                              {item.physical_not_available}
                            </span>
                          ) : (
                            <span className="text-slate font-normal">—</span>
                          )}
                        </td>

                        {/* 11. Condition */}
                        <td className="py-2 px-3 w-[100px] min-w-[100px] text-center whitespace-nowrap align-top">
                          {!item.is_counted && item.status === 'Not counted' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-line text-slate bg-surface">
                              Not counted
                            </span>
                          ) : condStr === 'good' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/50 text-emerald-700 bg-emerald-50/40">
                              Good
                            </span>
                          ) : condStr === 'damaged' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/50 text-rose-700 bg-rose-50/40">
                              Damaged
                            </span>
                          ) : condStr === 'fair' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/50 text-amber-700 bg-amber-50/40">
                              Fair
                            </span>
                          ) : item.condition && item.condition !== '—' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-line text-slate">
                              {item.condition}
                            </span>
                          ) : (
                            <span className="text-slate">—</span>
                          )}
                        </td>

                        {/* 12. Issued / Destroyed */}
                        <td className="py-2 px-3 w-[140px] min-w-[140px] text-center whitespace-nowrap align-top">
                          {dispStr === 'issued' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/50 text-emerald-700 bg-emerald-50/40">
                              Issued{item.issued_destroyed_qty > 1 ? ` × ${item.issued_destroyed_qty}` : ''}
                            </span>
                          ) : dispStr === 'destroyed' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/50 text-rose-700 bg-rose-50/40">
                              Destroyed{item.issued_destroyed_qty > 1 ? ` × ${item.issued_destroyed_qty}` : ''}
                            </span>
                          ) : (item.disposition && item.disposition !== '—' && item.disposition !== 'N/A') ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-line text-slate">
                              {item.disposition}{item.issued_destroyed_qty > 1 ? ` × ${item.issued_destroyed_qty}` : ''}
                            </span>
                          ) : (
                            <span className="text-slate">—</span>
                          )}
                        </td>

                        {/* 13. Special Remarks (wrapped downward, sans-serif, max 3 lines with Show more / Show less) */}
                        <td className="py-2.5 px-4 w-[240px] min-w-[240px] align-top text-slate text-xs font-sans whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] leading-[1.4]">
                          {item.remarks && item.remarks !== '—' && item.remarks.trim() !== '' ? (
                            <div className="w-full">
                              <div
                                title={!isExpanded ? item.remarks : undefined}
                                className={`${
                                  isExpanded ? '' : 'line-clamp-3'
                                } whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] font-sans print:line-clamp-none text-slate text-xs leading-[1.4]`}
                              >
                                {item.remarks}
                              </div>
                              {hasLongRemark && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRemark(rowKey);
                                  }}
                                  className="mt-1 text-[11px] font-medium text-signal hover:underline cursor-pointer block no-print focus:outline-none"
                                >
                                  {isExpanded ? 'Show less' : 'Show more'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate font-normal">—</span>
                          )}
                        </td>

                        {/* 14. Label No (wrapped downward when long, sans-serif; monospace when short <= 24 chars) */}
                        <td className={`py-2 px-3 align-top w-[150px] min-w-[150px] ${isLongLabel ? 'text-left' : 'text-center'}`}>
                          {labelStr ? (
                            isLongLabel ? (
                              <div className="w-full text-left font-sans text-xs text-ink whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] leading-[1.4]">
                                <div
                                  title={!isLabelExpanded ? labelStr : undefined}
                                  className={`${
                                    isLabelExpanded ? '' : 'line-clamp-3'
                                  } whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] font-sans print:line-clamp-none text-ink text-xs leading-[1.4]`}
                                >
                                  {labelStr}
                                </div>
                                {hasClampedLabel && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLabel(rowKey);
                                    }}
                                    className="mt-1 text-[11px] font-medium text-signal hover:underline cursor-pointer block no-print focus:outline-none"
                                  >
                                    {isLabelExpanded ? 'Show less' : 'Show more'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="bg-surface px-1.5 py-0.5 rounded border border-line text-ink font-mono text-xs inline-block">
                                {labelStr}
                              </span>
                            )
                          ) : (
                            <span className="text-slate font-normal">—</span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Bottom Back Button */}
      <div className="no-print">
        <BackButton to="/verification" id="btn-back-verification" />
      </div>
    </AppShell>
  );
};

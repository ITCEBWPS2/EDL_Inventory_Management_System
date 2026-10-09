import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { BackButton } from '../components/common/BackButton';
import { formatDate, exportToCSV } from '../utils/formatters';
import { Download, Printer, Plus, ChevronDown, Check } from 'lucide-react';

export const VerificationHistory = () => {
  const { selectedUnitId, selectedUnit, canWrite } = useAuth();
  const toast = useToast();

  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('2026');

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
          verifRes.data.filter(v => v.status === 'confirmed').forEach(v => {
            const vNames = [v.verifier_1, v.verifier_2, v.verifier_3].filter(Boolean);
            const verifiersDisplay = vNames.length > 0 
              ? vNames.join(', ')
              : (Array.isArray(v.verified_by) ? v.verified_by.join(', ') : (v.verified_by || ''));

            (v.items || []).forEach(item => {
              const sysQty = Number(item.system_qty || 0);
              const physQty = item.physical_qty !== null && item.physical_qty !== undefined && item.physical_qty !== ''
                ? Number(item.physical_qty)
                : sysQty;
              const physAvail = physQty;
              const physNotAvail = Math.max(0, sysQty - physQty);

              rows.push({
                id: item.id,
                verification_id: v.id,
                year: v.year,
                unit_id: v.unit_id,
                unit_name: v.unit_name,
                date: v.date,
                verified_by: verifiersDisplay,
                item_code: item.item_code || '',
                item_name: item.item_name || '',
                category: item.category || '',
                in_inventory: item.in_inventory !== false,
                system_qty: sysQty,
                physical_available: physAvail,
                physical_not_available: physNotAvail,
                condition: item.condition || 'Good',
                disposition: item.disposition || '—',
                remarks: item.remarks || item.special_remarks || '—',
                label_no: item.label_no || '—'
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
    const years = ['2026', '2025', '2024', 'All'];
    return years;
  }, []);

  // Filtered rows for display
  const displayItems = useMemo(() => {
    if (selectedYear === 'All') return historyItems;
    return historyItems.filter(item => String(item.year) === String(selectedYear));
  }, [historyItems, selectedYear]);

  // Export to CSV
  const handleExport = () => {
    if (!displayItems.length) {
      toast.error('No verification records available to export.');
      return;
    }

    const exportData = displayItems.map((item, idx) => ({
      'No': idx + 1,
      'Year': item.year,
      'Serial No.': item.item_code || '—',
      'Item': item.item_name,
      'Verification Date': item.date,
      'Verified By': item.verified_by || '—',
      'In Inventory': item.in_inventory ? 'Yes' : 'No',
      'System Qty': item.system_qty,
      'Physical Available': item.physical_available,
      'Physical Not Available': item.physical_not_available,
      'Condition': item.condition,
      'Issued / Destroyed': item.disposition && item.disposition !== '—' ? item.disposition : '—',
      'Special Remarks': item.remarks && item.remarks !== '—' ? item.remarks : '—',
      'Label No.': item.label_no && item.label_no !== '—' ? item.label_no : '—'
    }));

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
      {/* Printable Report Header */}
      <div className="hidden print:block mb-6">
        <div className="border-b-2 border-ink pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-ink uppercase tracking-wide">
                Electricity Distribution Lanka (Pvt) Ltd
              </h1>
              <p className="text-sm font-semibold text-slate mt-0.5">
                Annual Board of Survey — Verification History Archive
              </p>
            </div>
            <div className="text-right text-xs font-mono text-slate">
              <div>EDL-IMS AUDIT REGISTER</div>
              <div>Audit Year: {selectedYear}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 text-xs">
            <div>
              <span className="font-bold text-slate uppercase block">Location Scope</span>
              <span className="font-semibold text-ink">
                {selectedUnit ? `${selectedUnit.unit_name} (${selectedUnit.unit_code})` : 'All Operating Units'}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate uppercase block">Total Verified Records</span>
              <span className="font-semibold text-ink">{displayItems.length} records</span>
            </div>
            <div>
              <span className="font-bold text-slate uppercase block">Report Generated</span>
              <span className="font-semibold text-ink">{new Date().toISOString().split('T')[0]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Verification History</h1>
          <p className="text-xs text-slate mt-0.5">
            Audit history archive of confirmed physical inventory surveys and count reconciliations
          </p>
        </div>

        {canWrite && (
          <Link
            to="/verification/new"
            className="px-4 py-2 bg-ink hover:bg-[#193254] text-white text-xs font-semibold rounded-lg transition-colors shadow-subtle flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-signal" />
            <span>Start New Survey</span>
          </Link>
        )}
      </div>

      {/* Top Filter and Action Bar (matching Screenshots 7 & 8) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 no-print">
        {/* Left: Year dropdown + count pill badge */}
        <div className="flex items-center gap-3">
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

        {/* Right: Export and Print buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 bg-card hover:bg-surface border border-line text-ink text-xs font-semibold rounded-lg transition-colors shadow-subtle flex items-center gap-1.5"
            title="Export verification records as CSV"
          >
            <Download className="w-3.5 h-3.5 text-signal" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-card hover:bg-surface border border-line text-ink text-xs font-semibold rounded-lg transition-colors shadow-subtle flex items-center gap-1.5"
            title="Print Landscape Verification Archive"
          >
            <Printer className="w-3.5 h-3.5 text-signal" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Table: Horizontally Scrollable (matching Screenshots 7 & 8) */}
      <div className="bg-card border border-line rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface/70 font-semibold text-slate uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3 w-12 text-center">No</th>
                <th className="py-3 px-3 whitespace-nowrap">Year</th>
                <th className="py-3 px-3 whitespace-nowrap">Serial No.</th>
                <th className="py-3 px-4 min-w-[170px]">Item</th>
                <th className="py-3 px-3 whitespace-nowrap">Verification Date</th>
                <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">Verified By</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">In Inventory</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">System Qty</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Physical Available</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Physical Not Available</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Condition</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Issued / Destroyed</th>
                <th className="py-3 px-4 min-w-[180px]">Special Remarks</th>
                <th className="py-3 px-3 whitespace-nowrap">Label No</th>
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
                  const isNotAvailPos = Number(item.physical_not_available) > 0;
                  const condStr = (item.condition || '').toLowerCase();
                  const dispStr = (item.disposition || '').toLowerCase();

                  return (
                    <tr key={item.id || idx} className="hover:bg-surface/50 transition-colors">
                      {/* 1. No */}
                      <td className="py-3 px-3 text-center text-slate font-mono font-medium">
                        {idx + 1}
                      </td>

                      {/* 2. Year */}
                      <td className="py-3 px-3 font-mono font-bold text-ink whitespace-nowrap">
                        {item.year}
                      </td>

                      {/* 3. Serial No. */}
                      <td className="py-3 px-3 font-mono font-semibold text-ink whitespace-nowrap">
                        {item.item_code || '—'}
                      </td>

                      {/* 4. Item */}
                      <td className="py-3 px-4 font-semibold text-ink leading-tight">
                        {item.item_name}
                      </td>

                      {/* 5. Verification Date */}
                      <td className="py-3 px-3 font-mono text-slate whitespace-nowrap">
                        {item.date ? String(item.date).split('T')[0] : '—'}
                      </td>

                      {/* 6. Verified By */}
                      <td className="py-3 px-4 text-slate whitespace-nowrap">
                        {item.verified_by || '—'}
                      </td>

                      {/* 7. In Inventory (black pill badge "Yes") */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-ink text-white">
                          Yes
                        </span>
                      </td>

                      {/* 8. System Qty */}
                      <td className="py-3 px-3 text-center font-bold text-ink font-mono text-sm">
                        {item.system_qty}
                      </td>

                      {/* 9. Physical Available (green text) */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-[#2F7A5C] text-sm">
                        {item.physical_available}
                      </td>

                      {/* 10. Physical Not Available (red if > 0, grey if 0) */}
                      <td className={`py-3 px-3 text-center font-mono font-bold text-sm ${
                        isNotAvailPos ? 'text-[#B4483A]' : 'text-slate'
                      }`}>
                        {item.physical_not_available}
                      </td>

                      {/* 11. Condition (outline badge) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {condStr === 'good' ? (
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

                      {/* 12. Issued / Destroyed (badge or "—") */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {dispStr === 'issued' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/50 text-emerald-700 bg-emerald-50/40">
                            Issued
                          </span>
                        ) : dispStr === 'destroyed' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/50 text-rose-700 bg-rose-50/40">
                            Destroyed
                          </span>
                        ) : item.disposition && item.disposition !== '—' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-line text-slate">
                            {item.disposition}
                          </span>
                        ) : (
                          <span className="text-slate">—</span>
                        )}
                      </td>

                      {/* 13. Special Remarks */}
                      <td className="py-3 px-4 text-slate text-xs max-w-xs truncate">
                        {item.remarks && item.remarks !== '—' ? item.remarks : <span className="text-slate">—</span>}
                      </td>

                      {/* 14. Label No */}
                      <td className="py-3 px-3 font-mono font-medium text-ink whitespace-nowrap">
                        {item.label_no && item.label_no !== '—' ? item.label_no : <span className="text-slate">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Back Button */}
      <div className="no-print">
        <BackButton to="/verification" id="btn-back-verification" />
      </div>
    </AppShell>
  );
};

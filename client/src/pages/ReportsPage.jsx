import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate, formatNumber, exportToCSV } from '../utils/formatters';
import { Download, Printer, Filter, BarChart2, ArrowUpDown, ShieldCheck } from 'lucide-react';

export const ReportsPage = () => {
  const { selectedUnitId, selectedUnit } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('inventory'); // inventory | transactions | verification
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionType, setTransactionType] = useState('all');

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'inventory') {
        const res = await api.get('/reports/inventory', { unit_id: selectedUnitId });
        if (res.success) setReportData(res);
      } else if (activeTab === 'transactions') {
        const res = await api.get('/reports/transactions', {
          unit_id: selectedUnitId,
          start_date: startDate,
          end_date: endDate,
          type: transactionType
        });
        if (res.success) setReportData(res);
      } else if (activeTab === 'verification') {
        const res = await api.get('/reports/verification', { unit_id: selectedUnitId });
        if (res.success) setReportData(res);
      }
    } catch (err) {
      toast.error('Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, selectedUnitId, transactionType]);

  const handleExportCSV = () => {
    if (!reportData?.data?.length) {
      toast.error('No report data available to export.');
      return;
    }

    if (activeTab === 'inventory') {
      const csv = reportData.data.map(r => ({
        'Serial No.': r.item_code,
        'Item Description': r.item_name,
        'Category': r.category,
        'Unit': r.unit_name,
        'Total Received': r.total_received,
        'Total Expended': r.total_expended,
        'Remaining Quantity': r.remaining_qty,
        'Stock Status': r.stock_status
      }));
      exportToCSV(csv, `EDL_Stock_Report_${selectedUnit?.unit_code || 'All'}.csv`);
    } else if (activeTab === 'transactions') {
      const csv = reportData.data.map(t => ({
        'Transaction Type': t.tx_type,
        'Date': t.date,
        'Voucher No': t.voucher_no,
        'Serial No.': t.item_code,
        'Item Name': t.item_name,
        'Quantity': t.quantity,
        'Destination/Partner': t.partner_or_disposition,
        'Unit': t.unit_name
      }));
      exportToCSV(csv, `EDL_Transactions_Report_${selectedUnit?.unit_code || 'All'}.csv`);
    } else if (activeTab === 'verification') {
      const csv = reportData.data.map(v => ({
        'Audit Year': v.year,
        'Date': v.date,
        'Unit': v.unit_name,
        'Status': v.status,
        'Verifiers': (v.verified_by || []).join('; '),
        'Discrepancies': (v.items || []).filter(i => i.difference !== 0).length
      }));
      exportToCSV(csv, `EDL_Audit_Verification_Report_${selectedUnit?.unit_code || 'All'}.csv`);
    }

    toast.success('Report successfully exported as CSV.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Reports' }, { label: activeTab === 'inventory' ? 'Current Inventory' : (activeTab === 'transactions' ? 'Transaction History' : 'Verification Audit') }]}>
      {/* Printable Official Header */}
      <div className="hidden print:block mb-6 text-center border-b-2 border-ink pb-4">
        <h1 className="text-xl font-bold uppercase text-ink">Electricity Distribution Lanka (Pvt) Ltd</h1>
        <div className="text-sm font-semibold text-slate">Regional Logistics &amp; Stores Inventory Department</div>
        <div className="text-xs text-slate mt-1 font-mono">
          Report Generated: {new Date().toLocaleString()} &bull; Unit: {selectedUnit?.unit_name || 'All Units'}
        </div>
      </div>

      {/* Screen Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Executive Inventory Reports</h1>
          <p className="text-xs text-slate mt-0.5">
            Certified stock levels, transaction audit logs, and Board of Survey findings for{' '}
            <span className="font-semibold text-ink">{selectedUnit ? selectedUnit.unit_name : 'All Units'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-card hover:bg-surface border border-line text-ink text-xs font-semibold rounded transition-colors shadow-subtle flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-signal" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-ink hover:bg-[#193254] text-white text-xs font-medium rounded transition-colors shadow-subtle flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-signal" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Type Tabs (No Print) */}
      <div className="flex items-center gap-2 border-b border-line mb-6 no-print">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-signal text-ink bg-card rounded-t'
              : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>1. Current Inventory Report</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-signal text-ink bg-card rounded-t'
              : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          <ArrowUpDown className="w-4 h-4" />
          <span>2. Transaction History Report</span>
        </button>

        <button
          onClick={() => setActiveTab('verification')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'verification'
              ? 'border-signal text-ink bg-card rounded-t'
              : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>3. Verification Audit Report</span>
        </button>
      </div>

      {/* Transaction Date Filter Controls */}
      {activeTab === 'transactions' && (
        <div className="bg-card p-4 rounded-xl border border-line mb-6 flex flex-wrap items-center gap-4 text-xs no-print">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">Type:</span>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="px-2.5 py-1.5 bg-surface border border-line rounded text-ink"
            >
              <option value="all">All (Received &amp; Expended)</option>
              <option value="received">Received Only (In)</option>
              <option value="expended">Expended Only (Out)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">Start:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-surface border border-line rounded text-ink"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">End:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-surface border border-line rounded text-ink"
            />
          </div>

          <button
            onClick={fetchReport}
            className="px-3 py-1.5 bg-ink text-white rounded font-medium hover:bg-[#193254]"
          >
            Apply Filters
          </button>
        </div>
      )}

      {/* Summary KPI Highlights */}
      {reportData?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {activeTab === 'inventory' && (
            <>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Total Items</div>
                <div className="text-xl font-bold text-ink tabular-nums">{reportData.summary.total_items}</div>
              </div>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Total Units In Stock</div>
                <div className="text-xl font-bold text-ink tabular-nums">{formatNumber(reportData.summary.total_quantity)}</div>
              </div>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Low Stock Warnings</div>
                <div className="text-xl font-bold text-[#D6922C] tabular-nums">{reportData.summary.low_stock_count}</div>
              </div>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Out of Stock SKUs</div>
                <div className="text-xl font-bold text-[#B4483A] tabular-nums">{reportData.summary.out_of_stock_count}</div>
              </div>
            </>
          )}

          {activeTab === 'transactions' && (
            <>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Total Transactions</div>
                <div className="text-xl font-bold text-ink tabular-nums">{reportData.summary.total_transactions}</div>
              </div>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Total Units Received</div>
                <div className="text-xl font-bold text-[#2F7A5C] tabular-nums">+{formatNumber(reportData.summary.total_received_qty)}</div>
              </div>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Total Units Expended</div>
                <div className="text-xl font-bold text-[#B4483A] tabular-nums">-{formatNumber(reportData.summary.total_expended_qty)}</div>
              </div>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Net Flow</div>
                <div className="text-xl font-bold text-ink tabular-nums">
                  {formatNumber(reportData.summary.total_received_qty - reportData.summary.total_expended_qty)}
                </div>
              </div>
            </>
          )}

          {activeTab === 'verification' && (
            <>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Total Board Surveys</div>
                <div className="text-xl font-bold text-ink tabular-nums">{reportData.summary.total_verifications}</div>
              </div>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">Confirmed &amp; Locked</div>
                <div className="text-xl font-bold text-[#2F7A5C] tabular-nums">{reportData.summary.confirmed_count}</div>
              </div>
              <div className="bg-card p-3 rounded-lg border border-line">
                <div className="text-[11px] text-slate">In Draft Mode</div>
                <div className="text-xl font-bold text-slate tabular-nums">{reportData.summary.draft_count}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Report Table */}
      <div className="bg-card rounded-xl border border-line shadow-card overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            {activeTab === 'inventory' && (
              <tr className="border-b border-line bg-surface/80 text-[11px] font-semibold text-slate uppercase">
                <th className="py-3 px-3">Serial No.</th>
                <th className="py-3 px-3">Item Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3 text-right">Received (Σ In)</th>
                <th className="py-3 px-3 text-right">Expended (Σ Out)</th>
                <th className="py-3 px-3 text-right">Current Balance</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            )}

            {activeTab === 'transactions' && (
              <tr className="border-b border-line bg-surface/80 text-[11px] font-semibold text-slate uppercase">
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Voucher No</th>
                <th className="py-3 px-3">Item Name</th>
                <th className="py-3 px-3">Serial No.</th>
                <th className="py-3 px-3 text-right">Qty</th>
                <th className="py-3 px-3">Destination / Source</th>
                <th className="py-3 px-3">Unit</th>
              </tr>
            )}

            {activeTab === 'verification' && (
              <tr className="border-b border-line bg-surface/80 text-[11px] font-semibold text-slate uppercase">
                <th className="py-3 px-3">Year</th>
                <th className="py-3 px-3">Audit Date</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Board of Survey Verifiers</th>
                <th className="py-3 px-3">Audit Findings &amp; Summary</th>
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate">
                  Generating verified audit report...
                </td>
              </tr>
            ) : !reportData?.data?.length ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate">
                  No records matching the selected parameters.
                </td>
              </tr>
            ) : (
              reportData.data.map((row, i) => (
                <tr key={i} className="hover:bg-surface/50">
                  {activeTab === 'inventory' && (
                    <>
                      <td className="py-2.5 px-3 font-mono font-semibold text-ink">{row.item_code}</td>
                      <td className="py-2.5 px-3 font-medium text-ink">{row.item_name}</td>
                      <td className="py-2.5 px-3 text-slate">{row.category}</td>
                      <td className="py-2.5 px-3 text-slate">{row.unit_name}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#2F7A5C]">+{row.total_received}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#B4483A]">-{row.total_expended}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-ink">{formatNumber(row.remaining_qty)}</td>
                      <td className="py-2.5 px-3 text-center"><StatusBadge status={row.stock_status} /></td>
                    </>
                  )}

                  {activeTab === 'transactions' && (
                    <>
                      <td className="py-2.5 px-3"><StatusBadge status={row.type_badge || row.tx_type} /></td>
                      <td className="py-2.5 px-3 text-slate">{formatDate(row.date)}</td>
                      <td className="py-2.5 px-3 font-mono text-ink font-semibold">{row.voucher_no}</td>
                      <td className="py-2.5 px-3 font-medium text-ink">{row.item_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate">{row.item_code}</td>
                      <td className={`py-2.5 px-3 text-right font-bold tabular-nums ${row.tx_type === 'Expended' ? 'text-[#B4483A]' : 'text-[#2F7A5C]'}`}>
                        {row.tx_type === 'Expended' ? `-${row.quantity}` : `+${row.quantity}`}
                      </td>
                      <td className="py-2.5 px-3 text-slate">{row.partner_or_disposition}</td>
                      <td className="py-2.5 px-3 text-slate text-[11px]">{row.unit_name}</td>
                    </>
                  )}

                  {activeTab === 'verification' && (
                    <>
                      <td className="py-2.5 px-3 font-mono font-bold text-ink">{row.year}</td>
                      <td className="py-2.5 px-3 text-slate">{formatDate(row.date)}</td>
                      <td className="py-2.5 px-3 text-slate">{row.unit_name}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={row.status} /></td>
                      <td className="py-2.5 px-3 text-slate">{row.verified_by?.join(', ')}</td>
                      <td className="py-2.5 px-3 text-slate text-[11px] max-w-sm truncate">{row.summary || 'Board of Survey verification completed.'}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
};

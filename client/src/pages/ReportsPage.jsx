import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate, formatNumber, exportToCSV } from '../utils/formatters';
import { DateInput } from '../components/common/DateInput';
import {
  Download, Printer, BarChart2, ArrowUpDown, ShieldCheck,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Scale, Package, Layers,
  Search, ChevronDown
} from 'lucide-react';
import { PrintHeader } from '../components/common/PrintHeader';
import { BackButton } from '../components/common/BackButton';
import { ExportButton } from '../components/ui/ExportButton';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { TablePagination } from '../components/common/TablePagination';

export const ReportsPage = () => {
  const { selectedUnitId, selectedUnit } = useAuth();
  const toast = useToast();
  const { tab } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Active tab derived strictly from URL: 'inventory' | 'transactions' | 'verification'
  const activeTab = React.useMemo(() => {
    if (tab === 'transactions' || location.pathname === '/reports/transactions') return 'transactions';
    if (tab === 'verification' || location.pathname === '/reports/verification') return 'verification';
    return 'inventory';
  }, [tab, location.pathname]);

  // Handle direct navigation to invalid subpaths
  useEffect(() => {
    if (tab && !['inventory', 'transactions', 'verification'].includes(tab)) {
      navigate('/reports', { replace: true });
    }
  }, [tab, navigate]);

  const [loading, setLoading] = useState(false);
  // Independent cache per tab so switching never flashes stale data or causes race-condition overwrites
  const [tabData, setTabData] = useState({
    inventory: null,
    transactions: null,
    verification: null
  });

  const reportData = tabData[activeTab];

  // Filters (Transactions)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionType, setTransactionType] = useState('all');

  // Inventory Report state
  const tableContainerRef = React.useRef(null);
  const [searchParams] = useSearchParams();
  const [inventorySearch, setInventorySearch] = useState(() => searchParams.get('search') || '');
  const [inventoryCategory, setInventoryCategory] = useState('all');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [showAllRows, setShowAllRows] = useState(false);
  const [pageSize, setPageSize] = useState(100);

  // Reset page and toggle when tab changes
  useEffect(() => {
    setInventoryPage(1);
    setShowAllRows(false);
  }, [activeTab]);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== inventorySearch) {
      setInventorySearch(q);
    }
  }, [searchParams]);

  // Clear caches when unit changes
  useEffect(() => {
    setTabData({
      inventory: null,
      transactions: null,
      verification: null
    });
  }, [selectedUnitId]);

  const fetchReport = async () => {
    setLoading(true);
    const targetTab = activeTab;
    try {
      if (targetTab === 'inventory') {
        const res = await api.get('/reports/inventory', { unit_id: selectedUnitId });
        if (res.success) {
          setTabData(prev => ({ ...prev, inventory: res }));
        }
      } else if (targetTab === 'transactions') {
        const res = await api.get('/reports/transactions', {
          unit_id: selectedUnitId,
          start_date: startDate,
          end_date: endDate,
          type: transactionType
        });
        if (res.success) {
          setTabData(prev => ({ ...prev, transactions: res }));
        }
      } else if (targetTab === 'verification') {
        const res = await api.get('/reports/verification', { unit_id: selectedUnitId });
        if (res.success) {
          setTabData(prev => ({ ...prev, verification: res }));
        }
      }
    } catch (err) {
      toast.error('Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const targetTab = activeTab;
    setLoading(true);

    const loadData = async () => {
      try {
        if (targetTab === 'inventory') {
          const res = await api.get('/reports/inventory', { unit_id: selectedUnitId });
          if (!isCancelled && res.success) {
            setTabData(prev => ({ ...prev, inventory: res }));
          }
        } else if (targetTab === 'transactions') {
          const res = await api.get('/reports/transactions', {
            unit_id: selectedUnitId,
            start_date: startDate,
            end_date: endDate,
            type: transactionType
          });
          if (!isCancelled && res.success) {
            setTabData(prev => ({ ...prev, transactions: res }));
          }
        } else if (targetTab === 'verification') {
          const res = await api.get('/reports/verification', { unit_id: selectedUnitId });
          if (!isCancelled && res.success) {
            setTabData(prev => ({ ...prev, verification: res }));
          }
        }
      } catch (err) {
        if (!isCancelled) toast.error('Failed to generate report.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, selectedUnitId, transactionType]);

  // Inventory filtering and categories
  const inventoryCategories = React.useMemo(() => {
    if (!reportData?.data || activeTab !== 'inventory') return [];
    const set = new Set();
    reportData.data.forEach(r => {
      const cat = r.inventory_category || r.category;
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [reportData, activeTab]);

  const filteredInventoryRows = React.useMemo(() => {
    if (!reportData?.data || activeTab !== 'inventory') return [];
    let list = reportData.data;
    if (inventoryCategory !== 'all') {
      list = list.filter(r => (r.inventory_category || r.category) === inventoryCategory);
    }
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase().trim();
      list = list.filter(r => {
        const sn = (r.serial_no || r.serial_number || r.item_code || '').toLowerCase();
        const desc = (r.item_description || r.item_name || '').toLowerCase();
        const cat = (r.inventory_category || r.category || '').toLowerCase();
        return sn.includes(q) || desc.includes(q) || cat.includes(q);
      });
    }
    return list;
  }, [reportData, activeTab, inventoryCategory, inventorySearch]);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventorySearch, inventoryCategory]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setShowAllRows(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const totalInventoryRows = filteredInventoryRows.length;
  const totalPages = Math.ceil(totalInventoryRows / pageSize) || 1;

  const handleExportCSV = () => {
    if (!reportData?.data?.length) {
      toast.error('No report data available to export.');
      return;
    }

    if (activeTab === 'inventory') {
      const csv = filteredInventoryRows.map((r, idx) => ({
        'No': idx + 1,
        'Serial No.': r.serial_no || r.serial_number || r.item_code,
        'Inventory Category': r.inventory_category || r.category,
        'Item Description': r.item_description || r.item_name,
        'Unit': r.unit_name
      }));
      exportToCSV(csv, `EDL_Current_Inventory_Report_${selectedUnit?.unit_code || 'All'}.csv`);
    } else if (activeTab === 'transactions') {
      const csv = reportData.data.map(t => ({
        'Transaction Type': t.tx_type,
        'Date': formatDate(t.date),
        'Voucher No': t.voucher_no || '',
        'Item Name': t.item_name,
        'Quantity': t.quantity,
        'Destination/Partner': t.partner_or_disposition,
        'Description': t.notes || '',
        'Unit': t.unit_name
      }));
      exportToCSV(csv, `EDL_Transactions_Report_${selectedUnit?.unit_code || 'All'}.csv`);
    } else if (activeTab === 'verification') {
      const csv = reportData.data.map(v => ({
        'Audit Year': v.year,
        'Date': formatDate(v.date),
        'Unit': v.unit_name,
        'Status': v.status,
        'Verifiers': (v.verified_by || []).join('; '),
        'Discrepancies': (v.items || []).filter(i => i.difference !== 0).length
      }));
      exportToCSV(csv, `EDL_Audit_Verification_Report_${selectedUnit?.unit_code || 'All'}.csv`);
    }

    try {
      api.post('/audit-logs/log-action', {
        action: 'EXPORT',
        module: 'Reports',
        entity_type: 'Report',
        entity_reference: activeTab,
        description: `Exported ${activeTab} report to CSV`,
        unit_id: selectedUnitId
      }).catch(() => {});
    } catch {}

    toast.success('Report successfully exported as CSV.');
  };

  const handleTabClick = (tabKey) => {
    navigate(`/reports/${tabKey}`, { replace: false });
  };

  const handlePrint = () => {
    try {
      api.post('/audit-logs/log-action', {
        action: 'PRINT',
        module: 'Reports',
        entity_type: 'Report',
        entity_reference: activeTab,
        description: `Printed ${activeTab} report`,
        unit_id: selectedUnitId
      }).catch(() => {});
    } catch {}

    setShowAllRows(true);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const reportTitles = {
    inventory: 'Current Inventory Report',
    transactions: 'Transaction History Report',
    verification: 'Verification Audit Report'
  };
  const activeReportTitle = reportTitles[activeTab] || 'Inventory Report';

  const getFiltersSummary = () => {
    if (activeTab === 'inventory') {
      const parts = [];
      if (inventoryCategory && inventoryCategory !== 'all') {
        parts.push(`Category: ${inventoryCategory}`);
      }
      if (inventorySearch && inventorySearch.trim()) {
        parts.push(`Search: "${inventorySearch.trim()}"`);
      }
      return parts.length ? parts.join(' • ') : null;
    }
    if (activeTab === 'transactions') {
      const parts = [];
      if (startDate && endDate) {
        parts.push(`Period: ${formatDate(startDate)} - ${formatDate(endDate)}`);
      } else if (startDate) {
        parts.push(`From: ${formatDate(startDate)}`);
      } else if (endDate) {
        parts.push(`To: ${formatDate(endDate)}`);
      }
      if (transactionType && transactionType !== 'all') {
        parts.push(`Type: ${transactionType.toUpperCase()}`);
      }
      return parts.length ? parts.join(' • ') : null;
    }
    return null;
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Reports', path: '/reports' }, { label: activeTab === 'inventory' ? 'Current Inventory' : (activeTab === 'transactions' ? 'Transaction History' : 'Verification Audit') }]}>
      <div className={activeTab === 'transactions' || activeTab === 'verification' ? 'print-landscape' : ''}>
        {/* Printable Official Header */}
        <div className="hidden print:block mb-4">
          <PrintHeader
            reportTitle={activeReportTitle}
            filtersSummary={getFiltersSummary()}
            showParentChain={false}
          />
        </div>

      {/* Screen Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Executive Inventory Reports</h1>
          <p className="text-xs text-slate mt-0.5">

            <span className="font-semibold text-ink">{selectedUnit ? selectedUnit.unit_name : 'All Units'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            label="Export CSV"
            onClick={handleExportCSV}
            title="Export report as CSV"
          />
          <ExportButton
            format="print"
            label="Print Report"
            onClick={handlePrint}
            title="Print report"
          />
        </div>
      </div>

      {/* Unified Single Report Card */}
      <div
        ref={tableContainerRef}
        className="bg-white rounded-2xl border border-[rgba(123,28,62,0.28)] shadow-[0_4px_14px_rgba(10,10,25,0.08),_0_1px_3px_rgba(10,10,25,0.05)] overflow-hidden mb-6"
      >
        {/* Row 1: Report Type Tabs inside card header */}
        <div className="border-b border-[rgba(27,27,36,0.08)] bg-white px-4 pt-2.5 pb-0 flex flex-wrap items-center gap-1 sm:gap-2 no-print">
          <button
            onClick={() => handleTabClick('inventory')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'inventory'
                ? 'border-[#7B1C3E] text-[#7B1C3E] font-bold -mb-[1px]'
                : 'border-transparent text-[#4A4D5A] hover:text-[#1B1B24] -mb-[1px]'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>1. Current Inventory Report</span>
          </button>

          <button
            onClick={() => handleTabClick('transactions')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'transactions'
                ? 'border-[#7B1C3E] text-[#7B1C3E] font-bold -mb-[1px]'
                : 'border-transparent text-[#4A4D5A] hover:text-[#1B1B24] -mb-[1px]'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>2. Transaction History Report</span>
          </button>

          <button
            onClick={() => handleTabClick('verification')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'verification'
                ? 'border-[#7B1C3E] text-[#7B1C3E] font-bold -mb-[1px]'
                : 'border-transparent text-[#4A4D5A] hover:text-[#1B1B24] -mb-[1px]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>3. Verification Audit Report</span>
          </button>
        </div>

        {/* Row 2: Toolbar & Inline Summary */}
        {activeTab === 'inventory' && (
          <div className="border-b border-[rgba(27,27,36,0.08)] bg-white px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs no-print">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#5F6270] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Search serial no, item, category..."
                  className="h-[32px] w-full pl-9 pr-3 bg-white border border-[rgba(27,27,36,0.22)] rounded-[9px] text-[#1B1B24] placeholder:text-[#5F6270] focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E] shadow-2xs transition-all"
                />
              </div>
              {inventoryCategories.length > 0 && (
                <div className="relative">
                  <select
                    value={inventoryCategory}
                    onChange={(e) => setInventoryCategory(e.target.value)}
                    className="h-[32px] appearance-none pl-3 pr-8 bg-white border border-[rgba(27,27,36,0.22)] rounded-[9px] text-[#1B1B24] font-medium focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E] shadow-2xs cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {inventoryCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#5F6270] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
              <span className="text-[#4A4D5A] text-xs font-medium hidden sm:inline">
                Showing <span className="font-semibold text-[#1B1B24] tabular-nums">{filteredInventoryRows.length}</span> items
              </span>
            </div>

            {/* Inline Stat Chips */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <StatCard
                variant="chip"
                label="Total Items"
                value={filteredInventoryRows.length}
                icon={Package}
                loading={loading}
                badgeText={inventoryCategory !== 'all' ? 'Filtered' : undefined}
              />
              <StatCard
                variant="chip"
                label="Active Categories"
                value={inventoryCategories.length}
                icon={Layers}
                loading={loading}
              />
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <>
            <div className="border-b border-[rgba(27,27,36,0.08)] bg-white px-4 py-3 flex flex-wrap items-center gap-3.5 text-xs no-print">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1B1B24]">Type:</span>
                <div className="relative">
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                    className="h-[32px] appearance-none pl-3 pr-8 bg-white border border-[rgba(27,27,36,0.22)] rounded-[9px] text-[#1B1B24] font-medium focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E] shadow-2xs cursor-pointer"
                  >
                    <option value="all">All (Received &amp; Expended)</option>
                    <option value="received">Received Only (In)</option>
                    <option value="expended">Expended Only (Out)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#5F6270] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1B1B24]">Start:</span>
                <div className="w-36">
                  <DateInput
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="!h-[32px] !rounded-[9px] !bg-white !border-[rgba(27,27,36,0.22)]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1B1B24]">End:</span>
                <div className="w-36">
                  <DateInput
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="!h-[32px] !rounded-[9px] !bg-white !border-[rgba(27,27,36,0.22)]"
                  />
                </div>
              </div>

              <Button
                size="regular"
                variant="primary"
                onClick={fetchReport}
                label="Apply Filters"
                className="!h-[32px] !rounded-[9px]"
              />
            </div>

            {reportData?.summary && (() => {
              const receivedQty = Number(reportData.summary.total_received_qty || 0);
              const expendedQty = Number(reportData.summary.total_expended_qty || 0);
              const netFlow = receivedQty - expendedQty;
              return (
                <div className="px-4 py-3 border-b border-[rgba(27,27,36,0.08)] bg-surface/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                      label="Total Transactions"
                      value={reportData.summary.total_transactions}
                      icon={ArrowLeftRight}
                      loading={loading}
                    />
                    <StatCard
                      label="Total Items Quantity Received"
                      value={reportData.summary.total_received_qty}
                      displayValue={`+${formatNumber(reportData.summary.total_received_qty)}`}
                      valueColor="#1F7A4D"
                      icon={ArrowDownLeft}
                      iconColor="#1F7A4D"
                      loading={loading}
                    />
                    <StatCard
                      label="Total Items Quantity Expended"
                      value={reportData.summary.total_expended_qty}
                      displayValue={`-${formatNumber(reportData.summary.total_expended_qty)}`}
                      valueColor="#B3261E"
                      icon={ArrowUpRight}
                      iconColor="#B3261E"
                      loading={loading}
                    />
                    <StatCard
                      label="Net Flow"
                      value={netFlow}
                      displayValue={formatNumber(netFlow)}
                      highlight={true}
                      icon={Scale}
                      loading={loading}
                    />
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Row 3: Main Report Table */}
        {(() => {
          const currentRows = activeTab === 'inventory' ? filteredInventoryRows : (reportData?.data || []);
          return (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-white shadow-xs">
                    {activeTab === 'inventory' && (
                      <tr className="border-b border-line bg-white text-[11.5px] font-semibold text-slate uppercase tracking-[0.04em]">
                        <th className="w-12 text-center" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>No.</th>
                        <th className="min-w-[160px] text-left font-semibold" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Serial No.</th>
                        <th className="min-w-[160px] text-left font-semibold" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Inventory Category</th>
                        <th className="min-w-[200px] text-left font-semibold" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Item Description</th>
                        <th className="min-w-[120px] text-left font-semibold" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Unit</th>
                      </tr>
                    )}

                    {activeTab === 'transactions' && (
                      <tr className="border-b border-line bg-white text-[11.5px] font-semibold text-slate uppercase tracking-[0.04em]">
                        <th className="w-[8%] min-w-[70px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Type</th>
                        <th className="w-[11%] min-w-[95px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Date</th>
                        <th className="w-[12%] min-w-[110px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Voucher No.</th>
                        <th className="w-[24%] min-w-[180px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Item Name</th>
                        <th className="w-[8%] min-w-[65px] text-right" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Quantity</th>
                        <th className="w-[18%] min-w-[150px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Destination /<br />Source</th>
                        <th className="w-[12%] min-w-[120px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Description</th>
                        <th className="w-[7%] min-w-[75px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Unit</th>
                      </tr>
                    )}

                    {activeTab === 'verification' && (
                      <tr className="border-b border-line bg-white text-[11.5px] font-semibold text-slate uppercase tracking-[0.04em]">
                        <th className="min-w-[70px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Year</th>
                        <th className="min-w-[100px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Audit Date</th>
                        <th className="min-w-[100px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Unit</th>
                        <th className="min-w-[90px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Status</th>
                        <th className="min-w-[180px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Board of Survey Verifiers</th>
                        <th className="min-w-[200px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Audit Findings &amp; Summary</th>
                      </tr>
                    )}
                  </thead>

                  <tbody className="divide-y divide-line">
                    {loading ? (
                      <tr>
                        <td colSpan={activeTab === 'inventory' ? 5 : (activeTab === 'transactions' ? 8 : 6)} className="py-12 text-center text-slate">
                          Generating verified audit report...
                        </td>
                      </tr>
                    ) : !currentRows.length ? (
                      <tr>
                        <td colSpan={activeTab === 'inventory' ? 5 : (activeTab === 'transactions' ? 8 : 6)} className="py-12 text-center text-slate">
                          No records matching the selected parameters.
                        </td>
                      </tr>
                    ) : (
                      currentRows.map((row, i) => {
                        const isRowVisible = activeTab !== 'inventory' || showAllRows || (i >= (inventoryPage - 1) * pageSize && i < inventoryPage * pageSize);
                        return (
                          <tr key={row.id || i} className={isRowVisible ? "hover:bg-surface/50" : "hidden print:table-row hover:bg-surface/50"}>
                            {activeTab === 'inventory' && (
                              <>
                                <td className="py-2.5 px-3 text-center text-slate font-medium tabular-nums">{i + 1}</td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-ink whitespace-nowrap">{row.serial_no || row.serial_number || row.item_code}</td>
                                <td className="py-2.5 px-3 text-slate whitespace-nowrap">{row.inventory_category || row.category}</td>
                                <td className="py-2.5 px-3 font-medium text-ink">{row.item_description || row.item_name}</td>
                                <td className="py-2.5 px-3 text-slate whitespace-nowrap">{row.unit_name}</td>
                              </>
                            )}

                            {activeTab === 'transactions' && (
                              <>
                                <td className="py-2.5 px-3 align-top whitespace-nowrap"><StatusBadge status={row.type_badge || row.tx_type} /></td>
                                <td className="py-2.5 px-3 align-top text-slate whitespace-nowrap">{formatDate(row.date)}</td>
                                <td className="py-2.5 px-3 align-top font-mono text-ink font-semibold whitespace-nowrap">{row.voucher_no || '—'}</td>
                                <td className="py-2.5 px-3 align-top font-medium text-ink break-words">{row.item_name}</td>
                                <td className={`py-2.5 px-3 align-top text-right font-bold tabular-nums whitespace-nowrap ${row.tx_type === 'Expended' ? 'text-[#B4483A]' : 'text-[#2F7A5C]'}`}>
                                  {row.tx_type === 'Expended' ? `-${row.quantity}` : `+${row.quantity}`}
                                </td>
                                <td className="py-2.5 px-3 align-top text-slate break-words">{row.partner_or_disposition}</td>
                                <td className="py-2.5 px-3 align-top text-slate text-[11px] break-words" title={row.notes || ''}>
                                  {row.notes && row.notes.trim() ? row.notes : '—'}
                                </td>
                                <td className="py-2.5 px-3 align-top text-slate text-[11px] whitespace-nowrap">{row.unit_name}</td>
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Row 4: Pagination Footer at Bottom of Table */}
              {activeTab === 'inventory' && totalInventoryRows > 0 && (
                <TablePagination
                  totalItems={totalInventoryRows}
                  page={inventoryPage}
                  pageSize={pageSize}
                  onPageChange={setInventoryPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[25, 50, 100, 200]}
                  showAll={showAllRows}
                  onToggleShowAll={() => setShowAllRows(!showAllRows)}
                  itemLabel="items"
                  scrollToRef={tableContainerRef}
                />
              )}
            </>
          );
        })()}
      </div>
      </div>

      {/* Back to Reports Overview */}
      <BackButton to="/reports" id="btn-back-reports" className="no-print" />
    </AppShell>
  );
};

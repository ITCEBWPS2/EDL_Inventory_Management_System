import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { AppShell } from '../components/layout/AppShell';
import { DateInput } from '../components/common/DateInput';
import { BackButton } from '../components/common/BackButton';
import { formatDate, exportToCSV } from '../utils/formatters';
import { PrintHeader } from '../components/common/PrintHeader';
import { ViewButton } from '../components/ui/ActionButtons';
import { ExportButton } from '../components/ui/ExportButton';
import {
  ShieldCheck,
  Search,
  Filter,
  RotateCcw,
  Download,
  Printer,
  RefreshCw,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';

// Format helper for DD/MM/YYYY HH:mm:ss
function formatAuditDateTime(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Helper to display IP address and source cleanly with legacy loopback support
function getIpDisplayInfo(log) {
  if (!log || !log.ip_address) {
    return { display: '—', sourceLabel: null, tooltip: null };
  }

  const raw = String(log.ip_address).trim();
  const isLegacyLoopback = !log.ip_source && (raw === '::1' || raw === '127.0.0.1');

  if (isLegacyLoopback) {
    return {
      display: `${raw} (local machine)`,
      sourceLabel: 'local machine',
      tooltip: 'Recorded prior to client IP detection upgrade. Real LAN IP is now captured on new events.'
    };
  }

  let sourceLabel = null;
  if (log.ip_source === 'local-resolved') {
    sourceLabel = 'local machine';
  } else if (log.ip_source === 'proxy') {
    sourceLabel = 'via proxy';
  } else if (log.ip_source === 'direct') {
    sourceLabel = 'direct';
  }

  const tooltipParts = [];
  if (log.ip_raw && log.ip_raw !== log.ip_address) {
    tooltipParts.push(`Server socket: ${log.ip_raw}`);
  }
  if (sourceLabel) {
    tooltipParts.push(`Connection: ${sourceLabel}`);
  }

  return {
    display: log.ip_address,
    sourceLabel,
    tooltip: tooltipParts.length ? tooltipParts.join(' • ') : undefined
  };
}

// Format helper for ISO date (YYYY-MM-DD) default last 30 days
function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0]
  };
}

// Action badge styling map
function getActionBadge(action = '') {
  const act = String(action).toUpperCase();
  switch (act) {
    case 'CREATE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'UPDATE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'DELETE':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'LOGIN':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'LOGOUT':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'LOGIN_FAILED':
      return 'bg-rose-50/70 text-rose-600 border-rose-300 ring-1 ring-rose-200';
    case 'PASSWORD_CHANGED':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'CONFIRM':
      return 'bg-teal-50 text-teal-800 border-teal-200 font-semibold';
    case 'SUBMIT':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'DISCARD':
      return 'bg-neutral-100 text-neutral-600 border-neutral-300';
    case 'ACTIVATE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'DEACTIVATE':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'EXPORT':
    case 'PRINT':
      return 'bg-slate-100 text-slate-600 border-slate-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export const AuditLogPage = () => {
  const { user, selectedUnitId, selectedUnit, isSuperAdmin, isLocalAdmin } = useAuth();
  const toast = useToast();

  const isAuthorized = isSuperAdmin || isLocalAdmin || user?.role === 'unit_head';

  // Filters State
  const defaultDates = useMemo(() => getDefaultDateRange(), []);
  const [fromDate, setFromDate] = useState(defaultDates.from);
  const [toDate, setToDate] = useState(defaultDates.to);
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Data & Loading States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [summary, setSummary] = useState({ total: 0, failed: 0, logins: 0, changes: 0 });

  // Dynamic filter dropdown options
  const [filterOptions, setFilterOptions] = useState({
    modules: [],
    actions: [],
    users: [],
    units: []
  });

  // Modal / Drawer Detail View
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeLog, setActiveLog] = useState(null);
  const [expandedRowIds, setExpandedRowIds] = useState(new Set());

  // Determine active unit ID for queries
  const effectiveUnitId = useMemo(() => {
    if (selectedUnitFilter) return selectedUnitFilter;
    if (selectedUnitId && selectedUnitId !== 'all') return selectedUnitId;
    return '';
  }, [selectedUnitFilter, selectedUnitId]);

  // Load filter options once and whenever allowed unit context shifts
  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await api.get('/audit-logs/filters');
      if (res.success && res.data) {
        setFilterOptions(res.data);
      }
    } catch (err) {
      console.warn('Failed to load audit filters:', err.message);
    }
  }, []);

  // Fetch audit logs from backend
  const fetchLogs = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        page_size: pageSize
      };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (effectiveUnitId) params.unit_id = effectiveUnitId;
      if (selectedUser !== 'all') params.user = selectedUser;
      if (selectedModule !== 'all') params.module = selectedModule;
      if (selectedAction !== 'all') params.action = selectedAction;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await api.get('/audit-logs', params);
      if (res.success) {
        setLogs(res.data || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
        if (res.summary) setSummary(res.summary);
      } else {
        throw new Error(res.message || 'Failed to retrieve audit records.');
      }
    } catch (err) {
      console.error('AuditLog fetch error:', err);
      setError(err.message || 'Failed to load audit logs.');
      toast.error(err.message || 'Error fetching audit logs.');
    } finally {
      setLoading(false);
    }
  }, [
    isAuthorized,
    page,
    pageSize,
    fromDate,
    toDate,
    effectiveUnitId,
    selectedUser,
    selectedModule,
    selectedAction,
    selectedStatus,
    searchText,
    toast
  ]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset all filters
  const handleResetFilters = () => {
    const dates = getDefaultDateRange();
    setFromDate(dates.from);
    setToDate(dates.to);
    setSelectedUser('all');
    setSelectedModule('all');
    setSelectedAction('all');
    setSelectedStatus('all');
    setSelectedUnitFilter('');
    setSearchText('');
    setPage(1);
  };

  // Export to CSV via backend endpoint
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (effectiveUnitId) params.append('unit_id', effectiveUnitId);
      if (selectedUser !== 'all') params.append('user', selectedUser);
      if (selectedModule !== 'all') params.append('module', selectedModule);
      if (selectedAction !== 'all') params.append('action', selectedAction);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchText.trim()) params.append('search', searchText.trim());

      const url = `/api/audit-logs/export?${params.toString()}`;
      
      const token = localStorage.getItem('edl_token');
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export request failed');
      }

      const csvText = await response.text();
      exportToCSV(csvText, `EDL_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);

      toast.success('Audit log exported successfully.');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export audit log.');
    }
  };

  // Browser Print
  const handlePrint = () => {
    try {
      api.post('/audit-logs/log-action', {
        action: 'PRINT',
        module: 'Settings',
        entity_type: 'AuditLog',
        description: `Printed activity audit log report (${total} records matching filters)`
      }).catch(() => {});
    } catch {}

    window.print();
  };

  const toggleRowExpansion = (id) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDetailModal = (log) => {
    setActiveLog(log);
    setDetailModalOpen(true);
  };

  const activeUnitDisplayName = useMemo(() => {
    if (selectedUnit) return selectedUnit.unit_name;
    if (isSuperAdmin) return 'All Units';
    return user?.unit_name || 'My Unit';
  }, [selectedUnit, isSuperAdmin, user]);

  if (!isAuthorized) {
    return (
      <AppShell breadcrumbs={[{ label: 'Settings' }, { label: 'Audit Log' }]}>
        <div className="max-w-2xl mx-auto py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-ink mb-2">Access Denied</h1>
          <p className="text-slate text-sm mb-6">
            You do not have administrative privileges to view the system audit log.
            This area is restricted to Super Administrators, Local Administrators, and Unit Heads.
          </p>
          <BackButton to="/dashboard" label="Return to Dashboard" className="justify-center" />
        </div>
      </AppShell>
    );
  }

  const filtersSummary = useMemo(() => {
    const parts = [];
    if (fromDate && toDate) {
      parts.push(`Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`);
    } else if (fromDate) {
      parts.push(`From: ${formatDate(fromDate)}`);
    } else if (toDate) {
      parts.push(`To: ${formatDate(toDate)}`);
    }
    if (selectedModule && selectedModule !== 'all') {
      parts.push(`Module: ${selectedModule}`);
    }
    if (selectedAction && selectedAction !== 'all') {
      parts.push(`Action: ${selectedAction}`);
    }
    if (selectedStatus && selectedStatus !== 'all') {
      parts.push(`Status: ${selectedStatus.toUpperCase()}`);
    }
    if (searchText && searchText.trim()) {
      parts.push(`Search: "${searchText.trim()}"`);
    }
    return parts.length ? parts.join(' • ') : null;
  }, [fromDate, toDate, selectedModule, selectedAction, selectedStatus, searchText]);

  return (
    <AppShell breadcrumbs={[{ label: 'Settings' }, { label: 'Audit Log' }]}>
      <div className="print-landscape">
        {/* Printable Official Header */}
        <div className="hidden print:block mb-4">
          <PrintHeader
            reportTitle="Activity Audit Log & Security Compliance Report"
            filtersSummary={filtersSummary}
          />
        </div>

      {/* Screen Header & Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-signal" />
              <span>Audit Log</span>
            </h1>
          </div>
          <p className="text-xs text-slate mt-0.5">
            Tamper-resistant activity log for <span className="font-semibold text-ink">{activeUnitDisplayName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="btn-unified-export group inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold text-[#2a1520] bg-white border border-[#e6dcd7] whitespace-nowrap select-none shrink-0 cursor-pointer transition-all duration-150 shadow-[0_1px_3px_rgba(90,18,48,0.05)] hover:bg-[#fbf6f1] hover:border-[#7a1a3c]/35 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh log entries"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#7a1a3c] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <ExportButton
            label="Export CSV"
            onClick={handleExportCSV}
            title="Export filtered records to CSV"
          />

          <ExportButton
            format="print"
            label="Print Report"
            onClick={handlePrint}
            title="Print audit log report"
          />
        </div>
      </div>

      {/* Summary KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 no-print">
        <div className="p-3 bg-card border border-line rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate uppercase tracking-wider">Total Events</div>
            <div className="text-lg font-bold text-ink mt-0.5 font-mono">{summary.total.toLocaleString()}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-slate">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 bg-card border border-line rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate uppercase tracking-wider">Failed Actions</div>
            <div className={`text-lg font-bold mt-0.5 font-mono ${summary.failed > 0 ? 'text-rose-600' : 'text-ink'}`}>
              {summary.failed.toLocaleString()}
            </div>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${summary.failed > 0 ? 'bg-rose-50 text-rose-600' : 'bg-surface text-slate'}`}>
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 bg-card border border-line rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate uppercase tracking-wider">Logins</div>
            <div className="text-lg font-bold text-ink mt-0.5 font-mono">{summary.logins.toLocaleString()}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-slate">
            <User className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 bg-card border border-line rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate uppercase tracking-wider">System Changes</div>
            <div className="text-lg font-bold text-ink mt-0.5 font-mono">{summary.changes.toLocaleString()}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-slate">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-card border border-line rounded-xl mb-5 shadow-2xs space-y-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Date Range: From */}
          <div>
            <label className="block text-[11px] font-medium text-slate mb-1">From Date</label>
            <DateInput
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs"
            />
          </div>

          {/* Date Range: To */}
          <div>
            <label className="block text-[11px] font-medium text-slate mb-1">To Date</label>
            <DateInput
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs"
            />
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate mb-1">User / Actor</label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-signal"
            >
              <option value="all">All Users</option>
              {filterOptions.users.map(u => (
                <option key={u.id} value={u.username || u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
          </div>

          {/* Module Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate mb-1">Module</label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-signal"
            >
              <option value="all">All Modules</option>
              {filterOptions.modules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate mb-1">Action</label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-signal"
            >
              <option value="all">All Actions</option>
              {filterOptions.actions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-signal"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Search & Unit Context Filter (if Super or Local Admin with multiple units) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-line/60">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search description, reference, serial number, username..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-signal"
            />
          </div>

          {(isSuperAdmin || (isLocalAdmin && filterOptions.units.length > 1)) && (
            <div className="w-full sm:w-60">
              <select
                value={selectedUnitFilter}
                onChange={(e) => {
                  setSelectedUnitFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-surface border border-line rounded-lg text-ink focus:outline-none focus:border-signal font-medium"
              >
                <option value="">{isSuperAdmin ? 'All Units (System Wide)' : 'All Allowed Units'}</option>
                {filterOptions.units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-1.5 text-xs font-medium text-slate hover:text-ink hover:bg-surface rounded-lg border border-transparent hover:border-line flex items-center justify-center gap-1 transition-colors self-end sm:self-auto shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-card border border-line rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#fcfbf9] border-b border-line text-[11px] font-semibold text-slate uppercase sticky top-0 z-10">
                <th className="min-w-[140px]" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Date &amp; Time</th>
                <th className="min-w-[120px]" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>User</th>
                <th className="min-w-[100px]" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Unit</th>
                <th className="min-w-[100px]" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Module</th>
                <th className="min-w-[90px]" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Action</th>
                <th className="min-w-[200px]" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Description</th>
                <th className="min-w-[100px] hidden print:table-cell" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Client IP</th>
                <th className="min-w-[90px] text-center" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Status</th>
                <th className="min-w-[100px] text-right no-print" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate">
                    <div className="inline-flex items-center gap-2 font-medium">
                      <RefreshCw className="w-4 h-4 animate-spin text-signal" />
                      <span>Retrieving activity records...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-rose-600">
                    <div className="inline-flex flex-col items-center gap-2">
                      <AlertCircle className="w-6 h-6 text-rose-500" />
                      <span className="font-semibold">{error}</span>
                      <button
                        type="button"
                        onClick={fetchLogs}
                        className="mt-2 px-3 py-1 bg-surface border border-line rounded-md text-ink text-xs font-medium hover:bg-card"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <ShieldCheck className="w-8 h-8 text-slate/40 mb-2" />
                      <p className="font-medium text-ink">No audit entries found</p>
                      <p className="text-[11px] text-slate mt-0.5">
                        No activity records matched the selected date range and filter parameters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedRowIds.has(log.id);
                  const isFailed = log.status === 'failed';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => openDetailModal(log)}
                      className="hover:bg-surface/50 transition-colors cursor-pointer group"
                    >
                      {/* Date & Time */}
                      <td className="py-2.5 px-3.5 align-top whitespace-nowrap font-mono text-[11px] text-ink">
                        {formatAuditDateTime(log.created_at)}
                      </td>

                      {/* User */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <div className="font-medium text-ink">{log.actor_name || 'System'}</div>
                        <div className="text-[10px] text-slate font-mono">
                          {log.actor_username ? `@${log.actor_username}` : ''}
                          {log.actor_role && (
                            <span className="ml-1 px-1 py-0.2 rounded bg-surface border border-line text-[9px] uppercase font-sans">
                              {log.actor_role.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap text-slate text-[11px]">
                        {log.unit_name || (log.unit_id ? log.unit_id.slice(0, 8) : 'System / All')}
                      </td>

                      {/* Module */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-ink border border-line">
                          {log.module}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-2.5 px-3 align-top">
                        <div
                          className={`text-ink leading-relaxed break-words ${
                            isExpanded ? '' : 'line-clamp-2'
                          }`}
                        >
                          {log.description}
                        </div>
                        {log.entity_reference && (
                          <div className="text-[10px] text-slate font-mono mt-0.5">
                            Ref: {log.entity_reference}
                          </div>
                        )}
                        {log.description.length > 120 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(log.id);
                            }}
                            className="text-[10px] text-signal font-semibold hover:underline mt-0.5 block"
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </td>

                      {/* Client IP (Visible in Print View) */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap font-mono text-[10px] hidden print:table-cell">
                        <div>{getIpDisplayInfo(log).display}</div>
                        {getIpDisplayInfo(log).sourceLabel && (
                          <div className="text-[9px] text-slate font-sans">
                            {getIpDisplayInfo(log).sourceLabel}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isFailed
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isFailed ? <AlertCircle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                          <span>{isFailed ? 'Failed' : 'Success'}</span>
                        </span>
                      </td>

                      {/* Eye View Details Button */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap text-right no-print">
                        <div className="flex items-center justify-end">
                          <ViewButton
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetailModal(log);
                            }}
                            title="View complete record and diff"
                            aria-label={`View audit log for ${log.action} by ${log.actor_name || 'System'}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-surface/50 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate no-print">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-surface border border-line rounded text-ink font-medium focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="hidden sm:inline">
              &bull; Showing {logs.length > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded border border-line bg-card hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed text-ink transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] font-medium text-ink">
              Page {page} of {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="p-1.5 rounded border border-line bg-card hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed text-ink transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="no-print">
        <BackButton to="/settings" label="Back to Settings" />
      </div>

      {/* Detail Drawer / Modal */}
      {detailModalOpen && activeLog && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto no-print animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            className="bg-card w-full max-w-3xl rounded-2xl border border-line shadow-modal overflow-hidden flex flex-col max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] m-auto shrink-0 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-line flex items-center justify-between bg-surface/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-signal/15 text-signal flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="font-semibold text-ink text-sm sm:text-base">
                    Audit Log Entry Detail
                  </h2>
                  <p className="text-[11px] text-slate font-mono">
                    ID: {activeLog.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 rounded-lg text-slate hover:text-ink hover:bg-surface transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Primary Highlights */}
              <div className="p-3.5 bg-surface/50 border border-line rounded-xl space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${getActionBadge(activeLog.action)}`}>
                    {activeLog.action}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-surface border border-line text-ink">
                    {activeLog.module}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      activeLog.status === 'failed'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {activeLog.status === 'failed' ? <AlertCircle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                    <span>{activeLog.status === 'failed' ? 'Failed' : 'Success'}</span>
                  </span>
                </div>

                <div className="font-medium text-ink text-sm pt-1">
                  {activeLog.description}
                </div>

                {activeLog.error_message && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 font-mono text-[11px]">
                    Error: {activeLog.error_message}
                  </div>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-card border border-line rounded-lg space-y-1.5">
                  <div className="text-[10px] font-semibold text-slate uppercase tracking-wider">Actor Information</div>
                  <div className="text-ink font-medium">{activeLog.actor_name || 'System'}</div>
                  <div className="text-slate font-mono text-[11px]">Username: @{activeLog.actor_username || '—'}</div>
                  <div className="text-slate text-[11px]">Role: <span className="font-semibold uppercase">{activeLog.actor_role || '—'}</span></div>
                  {activeLog.actor_id && <div className="text-slate font-mono text-[10px]">Actor ID: {activeLog.actor_id}</div>}
                </div>

                <div className="p-3 bg-card border border-line rounded-lg space-y-1.5">
                  <div className="text-[10px] font-semibold text-slate uppercase tracking-wider">Location &amp; Entity</div>
                  <div className="text-ink font-medium">Unit: {activeLog.unit_name || 'System / All Units'}</div>
                  <div className="text-slate text-[11px]">Entity Type: <span className="font-semibold">{activeLog.entity_type || '—'}</span></div>
                  <div className="text-slate font-mono text-[11px]">Reference: <span className="text-ink font-semibold">{activeLog.entity_reference || '—'}</span></div>
                </div>

                <div className="p-3 bg-card border border-line rounded-lg space-y-1.5">
                  <div className="text-[10px] font-semibold text-slate uppercase tracking-wider">Timestamps</div>
                  <div className="text-ink font-mono text-[11px]">Local: {formatAuditDateTime(activeLog.created_at)}</div>
                  <div className="text-slate font-mono text-[10px]">UTC ISO: {new Date(activeLog.created_at).toISOString()}</div>
                </div>

                <div className="p-3 bg-card border border-line rounded-lg space-y-1.5">
                  <div className="text-[10px] font-semibold text-slate uppercase tracking-wider">Request Telemetry</div>
                  {(() => {
                    const ipInfo = getIpDisplayInfo(activeLog);
                    return (
                      <div>
                        <div className="text-slate font-mono text-[11px]">
                          IP Address: <span className="text-ink font-semibold" title={ipInfo.tooltip}>{ipInfo.display}</span>
                        </div>
                        {ipInfo.sourceLabel && (
                          <div className="text-[10px] text-slate font-sans mt-0.5" title={ipInfo.tooltip}>
                            Source: {ipInfo.sourceLabel}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="text-slate font-mono text-[10px] truncate" title={activeLog.user_agent}>
                    Agent: {activeLog.user_agent || '—'}
                  </div>
                  <div className="text-slate font-mono text-[10px] truncate" title={activeLog.request_id}>
                    Request ID: {activeLog.request_id || '—'}
                  </div>
                </div>
              </div>

              {/* Before & After Diff / Changes Snapshot */}
              {activeLog.changes && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Field Changes &amp; State Diff</span>
                    <span className="text-[10px] text-slate">Redacted &amp; sanitized payload</span>
                  </div>

                  {/* If diff has before and after objects */}
                  {activeLog.changes.before || activeLog.changes.after ? (
                    <div className="border border-line rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-surface border-b border-line text-[10px] uppercase font-semibold text-slate">
                            <th className="py-2 px-3 w-1/4">Field</th>
                            <th className="py-2 px-3 w-3/8 bg-rose-50/30 text-rose-800">Before</th>
                            <th className="py-2 px-3 w-3/8 bg-emerald-50/30 text-emerald-800">After</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line font-mono text-[11px]">
                          {Array.from(new Set([
                            ...Object.keys(activeLog.changes.before || {}),
                            ...Object.keys(activeLog.changes.after || {})
                          ])).map(field => {
                            const bVal = activeLog.changes.before ? activeLog.changes.before[field] : undefined;
                            const aVal = activeLog.changes.after ? activeLog.changes.after[field] : undefined;
                            return (
                              <tr key={field} className="hover:bg-surface/30">
                                <td className="py-2 px-3 font-semibold text-ink align-top">{field}</td>
                                <td className="py-2 px-3 text-rose-700 bg-rose-50/15 align-top break-all">
                                  {bVal === undefined ? <span className="text-slate/40">—</span> : JSON.stringify(bVal, null, 2)}
                                </td>
                                <td className="py-2 px-3 text-emerald-700 bg-emerald-50/15 align-top break-all font-semibold">
                                  {aVal === undefined ? <span className="text-slate/40">—</span> : JSON.stringify(aVal, null, 2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* General Snapshot View */
                    <div className="bg-surface/70 border border-line rounded-lg p-3 overflow-x-auto">
                      <pre className="font-mono text-[11px] text-ink leading-relaxed">
                        {JSON.stringify(activeLog.changes, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-line bg-surface/50 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-line bg-card hover:bg-surface text-ink text-xs font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </AppShell>
  );
};


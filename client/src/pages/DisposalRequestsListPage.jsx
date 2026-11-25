import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { AppShell } from '../components/layout/AppShell';
import { StatusBadge } from '../components/common/StatusBadge';
import { AddButton } from '../components/ui/AddButton';
import { ViewButton, EditButton, DeleteButton } from '../components/ui/ActionButtons';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { formatDate } from '../utils/formatters';
import { EDL_LOGO } from '../constants/assets';
import edlLogo from '../assets/EDL.png';
import {
  canCreateDisposalRequest,
  canEditDraft,
  canDeleteDraft,
  isDisposalRecipientRole
} from '../utils/disposalPermissions';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Trash2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  CheckSquare,
  Building2,
  Boxes,
  Bell
} from 'lucide-react';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'board_appointed', label: 'Board Appointed' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_disposal', label: 'In Disposal' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' }
];

export const DisposalRequestsListPage = () => {
  const { user, selectedUnitId, selectedUnit } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [unreadRequestIds, setUnreadRequestIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canAdd = canCreateDisposalRequest(user);
  const isHandlingRole = isDisposalRecipientRole(user);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [res, notifRes] = await Promise.all([
        api.get('/disposal-requests', { unit_id: selectedUnitId || undefined }),
        isHandlingRole ? api.get('/notifications', { unread: 'true', limit: 50 }).catch(() => null) : Promise.resolve(null)
      ]);

      if (res.success) {
        setRequests(res.data || []);
      }
      if (notifRes && notifRes.success && Array.isArray(notifRes.data)) {
        const ids = new Set(notifRes.data.map(n => n.request_id).filter(Boolean));
        setUnreadRequestIds(ids);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load disposal requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedUnitId]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/disposal-requests/${deleteTarget.id}`);
      if (res.success) {
        toast.success('Draft disposal request deleted.');
        setDeleteTarget(null);
        await fetchRequests();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete disposal request.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Status filter
      if (activeFilter !== 'all' && req.status !== activeFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const noMatch = (req.request_no || '').toLowerCase().includes(q);
        const titleMatch = (req.title || '').toLowerCase().includes(q);
        const itemMatch = req.items?.some(i => (i.item_name || '').toLowerCase().includes(q));
        if (!noMatch && !titleMatch && !itemMatch) {
          return false;
        }
      }
      return true;
    });
  }, [requests, activeFilter, searchTerm]);

  // Counts by status
  const counts = useMemo(() => {
    const map = { all: requests.length };
    STATUS_FILTERS.forEach(f => {
      if (f.key !== 'all') {
        map[f.key] = requests.filter(r => r.status === f.key).length;
      }
    });
    return map;
  }, [requests]);

  // Summary counts
  const inReviewCount = (counts.board_appointed || 0) + (counts.submitted || 0);
  const approvedCount = counts.approved || 0;
  const completedCount = (counts.in_disposal || 0) + (counts.completed || 0);

  return (
    <AppShell breadcrumbs={[{ label: 'Annual Verification', path: '/verification' }, { label: 'Disposal Requests' }]}>
      <div className="space-y-6">
        {/* Branded EDL Hero Header */}
        <div className="bg-gradient-to-r from-card via-surface/60 to-card border border-line rounded-2xl p-5 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white border border-[#7B1C3E]/15 shadow-sm p-2 flex items-center justify-center shrink-0">
              <img
                src={edlLogo || EDL_LOGO}
                alt="EDL Logo"
                className="h-full w-auto object-contain select-none"
                onError={(e) => { e.currentTarget.src = EDL_LOGO; }}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-ink tracking-tight">
                  Disposal Requests
                </h1>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20">
                  Board of Survey
                </span>
              </div>
              <p className="text-xs text-slate mt-1 flex flex-wrap items-center gap-1.5">
                <span>Electricity Distribution Lanka</span>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1 text-ink font-semibold">
                  <Building2 className="w-3 h-3 text-signal" />
                  {selectedUnit?.unit_name || 'All Units'}
                </span>
                <span>&bull;</span>
                <span>Official Asset Write-Off &amp; Disposal Tracking</span>
              </p>
            </div>
          </div>

          {canAdd && (
            <AddButton
              label="New Disposal Request"
              to="/disposal-requests/new"
              id="btn-new-disposal-request"
            />
          )}
        </div>

        {/* Executive Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 bg-card border border-line rounded-xl shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate uppercase tracking-wider block">
                Total Requests
              </span>
              <span className="text-2xl font-black text-ink font-mono mt-0.5 block">
                {requests.length}
              </span>
            </div>
            <span className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center text-slate">
              <Boxes className="w-5 h-5 text-signal" />
            </span>
          </div>

          <div className="p-4 bg-card border border-line rounded-xl shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                In Review / Committee
              </span>
              <span className="text-2xl font-black text-amber-900 font-mono mt-0.5 block">
                {inReviewCount}
              </span>
            </div>
            <span className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Clock className="w-5 h-5" />
            </span>
          </div>

          <div className="p-4 bg-card border border-line rounded-xl shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                Approved for Disposal
              </span>
              <span className="text-2xl font-black text-blue-900 font-mono mt-0.5 block">
                {approvedCount}
              </span>
            </div>
            <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <CheckSquare className="w-5 h-5" />
            </span>
          </div>

          <div className="p-4 bg-card border border-line rounded-xl shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                Disposed / Completed
              </span>
              <span className="text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
                {completedCount}
              </span>
            </div>
            <span className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>
        </div>

        {/* Top Slim Banner for Handling Roles */}
        {isHandlingRole && counts.submitted > 0 && (
          <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5 text-amber-900 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{counts.submitted}</strong> {counts.submitted === 1 ? 'new disposal request is' : 'new disposal requests are'} waiting for the board
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveFilter('submitted')}
              className="px-3 py-1 bg-amber-200/90 hover:bg-amber-300 text-amber-950 font-semibold rounded-lg text-xs transition-colors"
            >
              Filter Submitted
            </button>
          </div>
        )}

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-surface/50 border border-line rounded-xl">
          {STATUS_FILTERS.map(f => {
            const count = counts[f.key] || 0;
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#7B1C3E] text-white shadow-subtle'
                    : 'text-slate hover:text-ink hover:bg-card'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-surface text-slate'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by request number, title, or item description..."
              className="w-full bg-card border border-line rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder:text-slate/60 focus:outline-none focus:border-signal shadow-2xs"
            />
          </div>
          <span className="text-xs text-slate font-medium hidden sm:inline-block">
            Showing <span className="font-bold text-ink">{filteredRequests.length}</span> of {requests.length} requests
          </span>
        </div>

        {/* Table Container */}
        <div className="bg-card border border-line rounded-xl shadow-subtle overflow-hidden">
          {loading ? (
            <div className="p-14 text-center text-xs text-slate flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-signal/20 border-t-signal rounded-full animate-spin"></div>
              <span className="font-medium">Loading disposal requests...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-14 text-center text-xs text-slate space-y-3">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-surface/80 border border-line p-2.5 flex items-center justify-center opacity-60">
                <img src={edlLogo || EDL_LOGO} alt="EDL" className="h-full w-auto object-contain grayscale" />
              </div>
              <div className="font-bold text-ink text-sm">No disposal requests found</div>
              <p className="max-w-md mx-auto text-slate text-xs">
                {requests.length === 0
                  ? 'No disposal requests have been created yet. Click "New Disposal Request" to start a Board of Survey write-off.'
                  : 'No requests matched the current filter criteria.'}
              </p>
              {canAdd && requests.length === 0 && (
                <div className="pt-2">
                  <AddButton
                    label="Initiate First Disposal Request"
                    to="/disposal-requests/new"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface/60 border-b border-line text-slate font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-36">Request No</th>
                    <th className="py-3 px-4">Title / Purpose</th>
                    <th className="py-3 px-4 w-44">Operational Unit</th>
                    <th className="py-3 px-3 w-16 text-center">Items</th>
                    <th className="py-3 px-4 w-36">Status</th>
                    <th className="py-3 px-4 w-32">Date Created</th>
                    <th className="py-3 px-4 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredRequests.map((req) => {
                    const isDraft = req.status === 'draft';
                    const userCanEditDraft = isDraft && canEditDraft(user, req);
                    const userCanDeleteDraft = isDraft && canDeleteDraft(user, req);
                    const isNew = req.status === 'submitted' && (
                      unreadRequestIds.has(req.id) ||
                      (isHandlingRole && !localStorage.getItem(`dr_opened_${user?.id}_${req.id}`))
                    );

                    return (
                      <tr
                        key={req.id}
                        className="hover:bg-surface/40 transition-colors group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-ink">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/disposal-requests/${req.id}`}
                              onClick={() => {
                                if (user?.id) localStorage.setItem(`dr_opened_${user.id}_${req.id}`, '1');
                              }}
                              className="text-[#7B1C3E] hover:underline"
                            >
                              {req.request_no}
                            </Link>
                            {isNew && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500 text-white tracking-wider animate-pulse shadow-2xs">
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-ink">
                          <Link
                            to={`/disposal-requests/${req.id}`}
                            onClick={() => {
                              if (user?.id) localStorage.setItem(`dr_opened_${user.id}_${req.id}`, '1');
                            }}
                            className="hover:text-signal line-clamp-1"
                          >
                            {req.title}
                          </Link>
                          {req.description && (
                            <p className="text-[11px] text-slate font-normal line-clamp-1 mt-0.5">
                              {req.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate">
                          <span className="font-medium text-ink">{req.unit_name || req.unit_id}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-ink">
                          {req.items?.length || 0}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            status={req.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          />
                        </td>
                        <td className="py-3 px-4 font-mono text-slate text-[11px]">
                          {formatDate(req.created_at)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <ViewButton
                              onClick={() => {
                                if (user?.id) localStorage.setItem(`dr_opened_${user.id}_${req.id}`, '1');
                                navigate(`/disposal-requests/${req.id}`);
                              }}
                              title="View request details"
                            />
                            {userCanEditDraft && (
                              <EditButton
                                onClick={() => navigate(`/disposal-requests/new?edit=${req.id}`)}
                                title="Edit draft request"
                              />
                            )}
                            {userCanDeleteDraft && (
                              <DeleteButton
                                onClick={() => setDeleteTarget(req)}
                                title="Delete draft request"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Delete Draft Disposal Request?"
          message={`Are you sure you want to permanently delete draft "${deleteTarget.request_no} - ${deleteTarget.title}"? This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete Draft'}
          cancelLabel="Cancel"
          danger={true}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppShell>
  );
};

export default DisposalRequestsListPage;

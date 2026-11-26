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
        <div className="relative overflow-hidden glass-card bg-white/75 backdrop-blur-md border border-[#e6dcd7] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7a1a3c] via-[#5a1230] to-[#f6c026]" />
          <div>
            <h1 className="text-xl font-bold text-[#280818] tracking-tight">
              Disposal Requests
            </h1>
            <div className="mt-1 flex items-center">
              <span className="inline-flex items-center gap-1 text-xs text-[#7a1a3c] font-semibold bg-[#7a1a3c]/[0.06] px-2 py-0.5 rounded-md border border-[#7a1a3c]/15">
                <Building2 className="w-3 h-3 text-[#f6c026]" />
                {selectedUnit?.unit_name || 'All Units'}
              </span>
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

        {/* Executive Metric Bar (Unified 4-in-1 glass bar) */}
        <div className="glass-card bg-white/75 backdrop-blur-md border border-[#e6dcd7] rounded-xl shadow-xs grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#e6dcd7]/80 overflow-hidden">
          {/* Segment 1: Total Requests (EDL Wine & Ink) */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between group hover:bg-[#7a1a3c]/[0.02] transition-colors">
            <div>
              <span className="text-[11px] font-semibold text-[#5c4c52] uppercase tracking-wider block">
                Total Requests
              </span>
              <span className="text-2xl font-black text-[#280818] font-mono mt-0.5 block">
                {requests.length}
              </span>
            </div>
            <span className="w-10 h-10 rounded-xl bg-[#7a1a3c]/10 border border-[#7a1a3c]/20 flex items-center justify-center text-[#7a1a3c] group-hover:scale-105 transition-transform">
              <Boxes className="w-5 h-5" />
            </span>
          </div>

          {/* Segment 2: In Review / Committee (EDL Gold) */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between group hover:bg-[#f6c026]/[0.04] transition-colors">
            <div>
              <span className="text-[11px] font-semibold text-[#92400e] uppercase tracking-wider block">
                In Review / Committee
              </span>
              <span className="text-2xl font-black text-[#78350f] font-mono mt-0.5 block">
                {inReviewCount}
              </span>
            </div>
            <span className="w-10 h-10 rounded-xl bg-[#f6c026]/15 border border-[#f6c026]/30 flex items-center justify-center text-[#b48209] group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </span>
          </div>

          {/* Segment 3: Approved for Disposal (EDL Deep Maroon / Wine) */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between group hover:bg-[#5a1230]/[0.02] transition-colors">
            <div>
              <span className="text-[11px] font-semibold text-[#5a1230] uppercase tracking-wider block">
                Approved for Disposal
              </span>
              <span className="text-2xl font-black text-[#3b0c20] font-mono mt-0.5 block">
                {approvedCount}
              </span>
            </div>
            <span className="w-10 h-10 rounded-xl bg-[#5a1230]/10 border border-[#5a1230]/20 flex items-center justify-center text-[#5a1230] group-hover:scale-105 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </span>
          </div>

          {/* Segment 4: Disposed / Completed (EDL Brand Maroon) */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between group hover:bg-[#7a1a3c]/[0.03] transition-colors">
            <div>
              <span className="text-[11px] font-semibold text-[#7a1a3c] uppercase tracking-wider block">
                Disposed / Completed
              </span>
              <span className="text-2xl font-black text-[#5a1230] font-mono mt-0.5 block">
                {completedCount}
              </span>
            </div>
            <span className="w-10 h-10 rounded-xl bg-[#7a1a3c]/10 border border-[#7a1a3c]/20 flex items-center justify-center text-[#7a1a3c] group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>
        </div>

        {/* Top Slim Banner for Handling Roles */}
        {isHandlingRole && counts.submitted > 0 && (
          <div className="bg-gradient-to-r from-[#fbf6f1] via-amber-50/70 to-white border border-[#f6c026]/40 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5 text-[#280818] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#f6c026] animate-ping"></span>
              <Clock className="w-4 h-4 text-[#b48209] shrink-0" />
              <span>
                <strong className="text-[#7a1a3c]">{counts.submitted}</strong> {counts.submitted === 1 ? 'new disposal request is' : 'new disposal requests are'} waiting for the board
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveFilter('submitted')}
              className="px-3 py-1 bg-[#7a1a3c] hover:bg-[#5a1230] text-white font-semibold rounded-lg text-xs transition-colors shadow-2xs"
            >
              Filter Submitted
            </button>
          </div>
        )}

        {/* Unified Table Container with Integrated Search & Filter Chips */}
        <div className="glass-card bg-white/85 backdrop-blur-md border border-[#e6dcd7] rounded-xl shadow-xs overflow-hidden">
          {/* Top Toolbar: Search Input + Counter */}
          <div className="p-3 sm:p-4 border-b border-[#e6dcd7] bg-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#8a7a80] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by request number, title, or item description..."
                className="w-full bg-white/95 border border-[#e6dcd7] rounded-lg pl-9 pr-3 py-2 text-xs text-[#280818] placeholder:text-[#8a7a80]/70 focus:outline-none focus:border-[#7a1a3c] focus:ring-2 focus:ring-[#7a1a3c]/15 shadow-2xs transition-all"
              />
            </div>
            <span className="text-xs text-[#5c4c52] font-medium hidden sm:inline-block">
              Showing <span className="font-bold text-[#280818]">{filteredRequests.length}</span> of {requests.length} requests
            </span>
          </div>

          {/* Status Filter Chips Row */}
          <div className="px-3 sm:px-4 py-2.5 bg-[#fbf6f1]/60 border-b border-[#e6dcd7] flex flex-wrap items-center gap-1.5">
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
                      ? 'bg-gradient-to-r from-[#5a1230] to-[#7a1a3c] text-white shadow-xs ring-1 ring-[#f6c026]/40'
                      : 'text-[#5c4c52] hover:text-[#7a1a3c] hover:bg-white/70'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : count > 0
                        ? 'bg-[#7a1a3c]/10 text-[#7a1a3c]'
                        : 'bg-[#eee6e1] text-[#8a7a80]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {loading ? (
            <div className="p-14 text-center text-xs text-[#5c4c52] flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-[#7a1a3c]/20 border-t-[#7a1a3c] rounded-full animate-spin"></div>
              <span className="font-medium">Loading disposal requests...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-14 text-center text-xs text-[#5c4c52] space-y-3">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-[#fbf6f1] border border-[#e6dcd7] p-2.5 flex items-center justify-center opacity-70">
                <img src={edlLogo || EDL_LOGO} alt="EDL" className="h-full w-auto object-contain grayscale" />
              </div>
              <div className="font-bold text-[#280818] text-sm">No disposal requests found</div>
              <p className="max-w-md mx-auto text-[#5c4c52] text-xs">
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
                  <tr className="bg-gradient-to-r from-[#7a1a3c]/[0.07] via-[#7a1a3c]/[0.04] to-[#7a1a3c]/[0.07] border-b border-[#7a1a3c]/15 text-[#5a1230] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-36">Request No</th>
                    <th className="py-3 px-4">Title / Purpose</th>
                    <th className="py-3 px-4 w-44">Unit</th>
                    <th className="py-3 px-3 w-16 text-center">Items</th>
                    <th className="py-3 px-4 w-36">Status</th>
                    <th className="py-3 px-4 w-32">Date Created</th>
                    <th className="py-3 px-4 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee6e1]">
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
                        className="hover:bg-[#7a1a3c]/[0.02] transition-colors group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#280818]">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/disposal-requests/${req.id}`}
                              onClick={() => {
                                if (user?.id) localStorage.setItem(`dr_opened_${user.id}_${req.id}`, '1');
                              }}
                              className="text-[#7a1a3c] hover:text-[#5a1230] hover:underline"
                            >
                              {req.request_no}
                            </Link>
                            {isNew && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-gradient-to-r from-[#f6c026] to-[#e5af1d] text-[#280818] tracking-wider animate-pulse shadow-2xs">
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#280818]">
                          <Link
                            to={`/disposal-requests/${req.id}`}
                            onClick={() => {
                              if (user?.id) localStorage.setItem(`dr_opened_${user.id}_${req.id}`, '1');
                            }}
                            className="hover:text-[#7a1a3c] line-clamp-1 transition-colors"
                          >
                            {req.title}
                          </Link>
                          {req.description && (
                            <p className="text-[11px] text-[#5c4c52] font-normal line-clamp-1 mt-0.5">
                              {req.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#5c4c52]">
                          <span className="font-medium text-[#280818]">{req.unit_name || req.unit_id}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-[#280818]">
                          {req.items?.length || 0}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            status={req.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          />
                        </td>
                        <td className="py-3 px-4 font-mono text-[#5c4c52] text-[11px]">
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

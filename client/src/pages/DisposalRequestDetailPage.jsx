import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { AppShell } from '../components/layout/AppShell';
import { BackButton } from '../components/common/BackButton';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate } from '../utils/formatters';
import { BoardOfSurveyPrint } from '../components/disposal/BoardOfSurveyPrint';
import { DestructionCertificatePrint } from '../components/disposal/DestructionCertificatePrint';
import { WayBillPrint } from '../components/disposal/WayBillPrint';
import { EDL_LOGO } from '../constants/assets';
import edlLogo from '../assets/EDL.png';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  RotateCcw,
  UserCheck,
  ClipboardCheck,
  Flame,
  Truck,
  Plus,
  Trash2,
  FileText,
  Paperclip,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Send,
  Edit2,
  Lock,
  X
} from 'lucide-react';
import {
  canCreateDisposalRequest,
  canEditDraft,
  canDeleteDraft,
  canSubmitRequest,
  canHandleDisposalSteps,
  canViewDisposalDetails,
  canViewDisposalOverview,
  canPrintDisposal,
  getUnitParentChain
} from '../utils/disposalPermissions';

const STEPPER_STAGES = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'board_appointed', label: 'Board Appointed' },
  { key: 'committee_decision', label: 'Committee Decision' },
  { key: 'in_disposal', label: 'Disposal' },
  { key: 'completed', label: 'Completed' }
];

export const DisposalRequestDetailPage = () => {
  const { id } = useParams();
  const { user, isSuperAdmin, systemUnits } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'items' | 'committee' | 'disposal' | 'timeline'

  // Modals state
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [committeeModalOpen, setCommitteeModalOpen] = useState(false);
  const [disposalModalOpen, setDisposalModalOpen] = useState(false);
  const [disposalModalType, setDisposalModalType] = useState('destruction'); // 'destruction' | 'tender'
  const [revertModalOpen, setRevertModalOpen] = useState(false);

  // Print mode: null | 'bos' | 'destruction' | 'waybill'
  const [printMode, setPrintMode] = useState(null);
  const [printRecordTarget, setPrintRecordTarget] = useState(null);

  const parentChain = useMemo(
    () => getUnitParentChain(request?.unit_id, systemUnits),
    [request?.unit_id, systemUnits]
  );

  const fetchRequest = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/disposal-requests/${id}`);
      if (res.success) {
        setRequest(res.data);
      }
    } catch (err) {
      // Fallback to safe overview endpoint for users with limited detail access
      try {
        const ovRes = await api.get(`/disposal-requests/${id}/overview`);
        if (ovRes.success && ovRes.data) {
          setRequest({ ...ovRes.data, isOverviewOnly: true });
          return;
        }
      } catch (ovErr) {
        // Fallback error ignored
      }
      toast.error(err.message || 'Failed to load disposal request details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [id]);

  // Stepper calculations
  const getStepStatus = (stepKey) => {
    if (!request) return 'upcoming';
    const s = request.status;

    if (s === 'rejected') {
      if (stepKey === 'submitted' || stepKey === 'board_appointed') return 'completed';
      if (stepKey === 'committee_decision') return 'rejected';
      return 'upcoming';
    }

    if (s === 'draft') return 'upcoming';

    const order = ['submitted', 'board_appointed', 'committee_decision', 'in_disposal', 'completed'];
    let currentIdx = -1;
    if (s === 'submitted') currentIdx = 0;
    else if (s === 'board_appointed') currentIdx = 1;
    else if (s === 'approved') currentIdx = 2; // Committee decision done
    else if (s === 'in_disposal') currentIdx = 3;
    else if (s === 'completed') currentIdx = 4;

    const stepIdx = order.indexOf(stepKey);
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'current';
    return 'upcoming';
  };

  const handlePrint = (mode, record = null) => {
    setPrintMode(mode);
    setPrintRecordTarget(record);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleSubmitDraft = async () => {
    try {
      const res = await api.post(`/disposal-requests/${id}/submit`);
      if (res.success) {
        toast.success('Disposal request submitted for Board Appointment!');
        fetchRequest();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit request.');
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: 'Disposal Requests', path: '/disposal-requests' }, { label: 'Loading...' }]}>
        <div className="p-12 text-center text-xs text-slate flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-signal/20 border-t-signal rounded-full animate-spin"></div>
          <span>Loading disposal request details...</span>
        </div>
      </AppShell>
    );
  }

  if (!request) {
    return (
      <AppShell breadcrumbs={[{ label: 'Disposal Requests', path: '/disposal-requests' }, { label: 'Not Found' }]}>
        <div className="p-12 text-center text-xs text-slate space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-semibold text-ink">Disposal Request Not Found</h2>
          <BackButton to="/disposal-requests" label="Back to Disposal Requests" />
        </div>
      </AppShell>
    );
  }

  const isDraft = request.status === 'draft';
  const isSubmitted = request.status === 'submitted';
  const isBoardAppointed = request.status === 'board_appointed';
  const isApproved = request.status === 'approved';
  const isInDisposal = request.status === 'in_disposal';
  const isCompleted = request.status === 'completed';
  const isRejected = request.status === 'rejected';

  // Permission checks
  const hasDetailsAccess = Boolean(
    request &&
    !request.isOverviewOnly &&
    canViewDisposalDetails(user, request)
  );

  // Counts of item decisions
  const approvedItems = request.items?.filter(
    i => i.committee_decision_item === 'Approve for Destruction' || i.committee_decision_item === 'Approve for Tender'
  ) || [];
  const destructionApproved = request.items?.filter(
    i => i.committee_decision_item === 'Approve for Destruction' && !i.final_disposition
  ) || [];
  const tenderApproved = request.items?.filter(
    i => i.committee_decision_item === 'Approve for Tender' && !i.final_disposition
  ) || [];

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/verification' },
        { label: 'Disposal Requests', path: '/disposal-requests' },
        { label: request.request_no }
      ]}
    >
      {/* Hidden Print Wrapper */}
      <div className="hidden print:block">
        {printMode === 'bos' && <BoardOfSurveyPrint request={request} />}
        {printMode === 'destruction' && <DestructionCertificatePrint request={request} record={printRecordTarget} />}
        {printMode === 'waybill' && <WayBillPrint request={request} record={printRecordTarget} />}
      </div>

      <div className="space-y-6 no-print">
        {/* Branded EDL Top Header Card */}
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
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xl font-black text-ink tracking-tight">
                  {request.request_no}
                </span>
                <StatusBadge
                  status={request.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                />
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20">
                  Board of Survey
                </span>
              </div>
              <h1 className="text-base font-bold text-ink">
                {request.title}
              </h1>
              <p className="text-xs text-slate flex flex-wrap items-center gap-1.5">
                <span>Electricity Distribution Lanka</span>
                <span>&bull;</span>
                <span>Operational Unit:</span>
                <span className="font-bold text-ink">{request.unit_name || request.unit_id}</span>
                <span>&bull;</span>
                <span>Initiated:</span>
                <span className="font-mono font-semibold text-ink">{formatDate(request.created_at)}</span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Draft actions: creator roles only */}
            {isDraft && canEditDraft(user, request) && (
              <Link
                to={`/disposal-requests/new?edit=${request.id}`}
                className="px-3 py-1.5 bg-card hover:bg-surface border border-line rounded-lg text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors shadow-subtle"
              >
                <Edit2 className="w-3.5 h-3.5 text-signal" />
                <span>Edit Draft</span>
              </Link>
            )}
            {isDraft && canSubmitRequest(user, request) && (
              <button
                type="button"
                onClick={handleSubmitDraft}
                className="px-3.5 py-1.5 bg-signal hover:bg-signal/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-subtle"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Board Appointment</span>
              </button>
            )}

            {/* Submitted: Record board appointment (handlers only) */}
            {isSubmitted && canHandleDisposalSteps(user, request) && (
              <button
                type="button"
                onClick={() => setBoardModalOpen(true)}
                className="px-3.5 py-1.5 bg-signal hover:bg-signal/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-subtle"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Record Board Appointment</span>
              </button>
            )}

            {/* Board Appointed: Record committee decision (handlers only) */}
            {isBoardAppointed && canHandleDisposalSteps(user, request) && (
              <button
                type="button"
                onClick={() => setCommitteeModalOpen(true)}
                className="px-3.5 py-1.5 bg-signal hover:bg-signal/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-subtle"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Record Committee Decision</span>
              </button>
            )}

            {/* Approved or In Disposal: Record destruction / tender (handlers only) */}
            {(isApproved || isInDisposal) && canHandleDisposalSteps(user, request) && (
              <div className="flex items-center gap-1.5">
                {destructionApproved.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDisposalModalType('destruction');
                      setDisposalModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-subtle"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Record Destruction ({destructionApproved.length})</span>
                  </button>
                )}
                {tenderApproved.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDisposalModalType('tender');
                      setDisposalModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-subtle"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Record Tender Release ({tenderApproved.length})</span>
                  </button>
                )}
              </div>
            )}

            {/* Print Board of Survey Report */}
            {!isDraft && canPrintDisposal(user, request) && (
              <button
                type="button"
                onClick={() => handlePrint('bos')}
                className="px-3 py-1.5 bg-card hover:bg-surface border border-line rounded-lg text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors shadow-subtle"
                title="Print Board of Survey Report"
              >
                <Printer className="w-3.5 h-3.5 text-signal" />
                <span>Print Report</span>
              </button>
            )}

            {/* Revert Last Step (handlers only) */}
            {!isDraft && canHandleDisposalSteps(user, request) && (
              <button
                type="button"
                onClick={() => setRevertModalOpen(true)}
                className="px-3 py-1.5 bg-surface hover:bg-rose-50 text-slate hover:text-rose-700 border border-line rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Revert last workflow step with reason"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert Last Step</span>
              </button>
            )}

            <BackButton to="/disposal-requests" label="Back to List" />
          </div>
        </div>

        {/* 5-Step Stepper */}
        <div className="bg-card border border-line rounded-xl p-4 shadow-subtle">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STEPPER_STAGES.map((st, idx) => {
              const statusState = getStepStatus(st.key);
              const isPast = statusState === 'completed';
              const isCurrent = statusState === 'current';
              const isRej = statusState === 'rejected';

              return (
                <div
                  key={st.key}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? 'border-signal bg-signal/5 ring-1 ring-signal'
                      : isPast
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                      : isRej
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : 'border-line bg-surface/30 text-slate opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1 font-mono text-[10px] font-bold">
                    <span>Step {idx + 1}</span>
                    {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    {isRej && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                  </div>
                  <div
                    className="text-xs font-semibold truncate"
                    title={
                      st.key === 'board_appointed'
                        ? `Board of Survey for ${request.unit_name || request.unit_id || 'Unit'}`
                        : st.label
                    }
                  >
                    {st.label}
                  </div>
                  {isRej && <div className="text-[10px] font-bold text-rose-600">All Items Rejected</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="border-b border-line flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { key: 'overview', label: 'Overview', locked: false },
            {
              key: 'items',
              label: `Items (${request.items_count ?? request.items?.length ?? 0})`,
              locked: !hasDetailsAccess
            },
            { key: 'committee', label: 'Committee', locked: !hasDetailsAccess },
            {
              key: 'disposal',
              label: `Disposal (${request.disposal_records?.length || 0})`,
              locked: !hasDetailsAccess
            },
            {
              key: 'timeline',
              label: `Timeline (${request.timeline_count ?? request.timeline?.length ?? 0})`,
              locked: !hasDetailsAccess
            }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-3.5 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'border-signal text-signal font-semibold'
                  : 'border-transparent text-slate hover:text-ink hover:border-line'
              }`}
            >
              <span>{tab.label}</span>
              {tab.locked && <Lock className="w-3 h-3 text-slate/50" />}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card border border-line rounded-xl p-4 space-y-1 shadow-subtle">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate">Request Details</span>
                <p className="text-xs text-ink font-semibold">{request.title}</p>
                <p className="text-[11px] text-slate">{request.description || 'No description provided.'}</p>
              </div>

              <div className="bg-card border border-line rounded-xl p-4 space-y-1 shadow-subtle">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate">Unit &amp; Scope</span>
                <p className="text-xs text-ink font-semibold">{request.unit_name || request.unit_id}</p>
                <p className="text-[11px] text-slate">Created by: {request.created_by_name || 'Staff'}</p>
              </div>

              <div className="bg-card border border-line rounded-xl p-4 space-y-1 shadow-subtle">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate">Workflow Stage</span>
                <div className="pt-1">
                  <StatusBadge
                    status={request.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  />
                </div>
                <p className="text-[11px] text-slate pt-1">
                  {request.items_count ?? request.items?.length ?? 0} line item(s) surveyed
                </p>
              </div>
            </div>

            {/* Quick Committee Snapshot if available */}
            {hasDetailsAccess && request.committee_decision && (
              <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Committee Decision Recorded</span>
                </div>
                <p className="text-slate text-[11px]">
                  <strong>Report Ref:</strong> {request.committee_decision.report_ref} &bull; <strong>Decision Date:</strong> {formatDate(request.committee_decision.decision_date)} &bull; <strong>Members Present:</strong> {request.committee_decision.members_present?.join(', ') || '—'}
                </p>
                {request.committee_decision.remarks && (
                  <p className="text-slate text-[11px]">
                    <strong>Remarks:</strong> {request.committee_decision.remarks}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Locked State for Tabs 2-5 when user has no detail access */}
        {!hasDetailsAccess && activeTab !== 'overview' && (
          <div className="bg-card border border-line rounded-xl p-12 text-center text-slate shadow-subtle space-y-2">
            <ShieldAlert className="w-8 h-8 text-slate/40 mx-auto" />
            <h3 className="text-sm font-semibold text-ink">Restricted Tab</h3>
            <p className="text-xs text-slate">You do not have access to these details.</p>
          </div>
        )}

        {/* Tab 2: Items Table */}
        {hasDetailsAccess && activeTab === 'items' && (
          <div className="bg-card border border-line rounded-xl shadow-subtle overflow-hidden">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">Surveyed Line Items</h2>
                <p className="text-[11px] text-slate">All assets included in this Board of Survey write-off request.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface/60 border-b border-line text-slate font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 w-28">Item Code</th>
                    <th className="py-2.5 px-3 w-14 text-center">Qty</th>
                    <th className="py-2.5 px-3">Serial Numbers</th>
                    <th className="py-2.5 px-3">Condition Notes</th>
                    <th className="py-2.5 px-3 w-40 font-bold">Committee Decision</th>
                    <th className="py-2.5 px-3">Committee Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {request.items?.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-surface/30 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-ink">
                        {item.item_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate text-[11px]">
                        {item.item_code || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-ink">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate text-[11px]">
                        {Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
                          ? item.serial_numbers.join(', ')
                          : (item.serial_number || '—')}
                      </td>
                      <td className="py-2.5 px-3 text-slate">
                        {item.condition_notes || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {item.committee_decision_item ? (
                          <StatusBadge status={item.committee_decision_item} />
                        ) : (
                          <span className="text-slate italic text-[11px]">Pending Decision</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate">
                        {item.committee_remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Committee Details */}
        {hasDetailsAccess && activeTab === 'committee' && (
          <div className="space-y-6">
            {/* Committee Unit Header Banner */}
            <div className="p-3 bg-surface/50 border border-line rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <span className="text-xs font-bold text-signal">
                  Committee for: {request.unit_name || request.unit_id}
                </span>
                {parentChain && <p className="text-[10px] text-slate mt-0.5">{parentChain}</p>}
              </div>
              <span className="text-[10px] font-mono text-slate uppercase bg-surface px-2 py-0.5 rounded border border-line self-start sm:self-auto">
                Operational Unit
              </span>
            </div>

            {/* Board Appointment Section */}
            <div className="bg-card border border-line rounded-xl p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-signal" />
                    <span>Board of Survey Appointment</span>
                  </h2>
                  <p className="text-[11px] text-slate">
                    Appointed committee members responsible for physical survey and decisions.
                  </p>
                </div>
                {isSubmitted && canHandleDisposalSteps(user, request) && (
                  <button
                    type="button"
                    onClick={() => setBoardModalOpen(true)}
                    className="px-3.5 py-1.5 bg-signal hover:bg-signal/90 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Record Appointment
                  </button>
                )}
              </div>

              {request.board?.members?.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-surface/40 rounded-lg text-xs">
                    {request.board.appointment_letter_no && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate">Appointment Letter No</span>
                        <p className="font-mono font-semibold text-ink">{request.board.appointment_letter_no}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate">Appointment Date</span>
                      <p className="font-mono text-ink">{formatDate(request.board.appointment_date)}</p>
                    </div>
                    {request.board.appointed_by_name && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate">Appointed By (DGM)</span>
                        <p className="text-ink">{request.board.appointed_by_name}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-2">
                      Committee Members ({(request.board?.members || []).length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(request.board?.members || []).map((m, idx) => (
                        <div key={idx} className="p-3 bg-surface/50 border border-line rounded-lg text-xs space-y-0.5">
                          <p className="font-bold text-ink">{m.name}</p>
                          <p className="text-slate text-[11px]">{m.designation || 'Committee Member'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate">
                  Board of Survey has not been recorded yet. Click "Record Board Appointment" when the appointment letter is issued.
                </div>
              )}
            </div>

            {/* Committee Decision Section */}
            <div className="bg-card border border-line rounded-xl p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-signal" />
                    <span>Committee Decision &amp; Inspection</span>
                  </h2>
                  <p className="text-[11px] text-slate">
                    Final disposal decisions decided and approved on paper by the Board of Survey.
                  </p>
                </div>
                {isBoardAppointed && canHandleDisposalSteps(user, request) && (
                  <button
                    type="button"
                    onClick={() => setCommitteeModalOpen(true)}
                    className="px-3.5 py-1.5 bg-signal hover:bg-signal/90 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Record Committee Decision
                  </button>
                )}
              </div>

              {request.committee_decision ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-surface/40 rounded-lg text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate">Report Reference</span>
                      <p className="font-mono font-semibold text-ink">{request.committee_decision.report_ref}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate">Decision Date</span>
                      <p className="font-mono text-ink">{formatDate(request.committee_decision.decision_date)}</p>
                    </div>
                    {request.committee_decision.inspection_date && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate">Inspection Date</span>
                        <p className="font-mono text-ink">{formatDate(request.committee_decision.inspection_date)}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate">Members Present</span>
                    <p className="text-xs text-ink font-medium mt-0.5">
                      {request.committee_decision.members_present?.join(', ') || '—'}
                    </p>
                  </div>

                  {request.committee_decision.remarks && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate">Remarks</span>
                      <p className="text-xs text-ink mt-0.5">{request.committee_decision.remarks}</p>
                    </div>
                  )}

                  {request.committee_decision.attachment?.url && (
                    <div className="p-3 bg-surface border border-line rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-signal" />
                        <div>
                          <p className="font-medium text-ink">
                            {request.committee_decision.attachment.original_name || 'Committee Report Scan'}
                          </p>
                          <p className="text-[10px] text-slate">
                            {request.committee_decision.attachment.size ? `${Math.round(request.committee_decision.attachment.size / 1024)} KB` : ''}
                          </p>
                        </div>
                      </div>
                      <a
                        href={request.committee_decision.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-card hover:bg-surface border border-line rounded text-xs font-semibold text-ink flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-signal" />
                        <span>View Scan</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate">
                  Committee decision has not been recorded yet. Available once Board of Survey is appointed.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Disposal Records */}
        {activeTab === 'disposal' && (
          <div className="space-y-4">
            <div className="bg-card border border-line rounded-xl p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    Disposal Execution Records ({request.disposal_records?.length || 0})
                  </h2>
                  <p className="text-[11px] text-slate">
                    Physical execution of destruction or tender sale as authorized by the committee.
                  </p>
                </div>
              </div>

              {request.disposal_records?.length > 0 ? (
                <div className="space-y-3">
                  {request.disposal_records.map(rec => {
                    const isDestruction = rec.type === 'destruction';

                    return (
                      <div
                        key={rec.id}
                        className="p-4 bg-surface/40 border border-line rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                isDestruction
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {rec.type}
                            </span>
                            <span className="font-mono font-bold text-ink">
                              Ref: {rec.reference}
                            </span>
                            {rec.waybill_no && (
                              <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                                Waybill: {rec.waybill_no}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePrint(isDestruction ? 'destruction' : 'waybill', rec)}
                              className="px-2.5 py-1 bg-card hover:bg-surface border border-line rounded text-[11px] font-semibold text-ink flex items-center gap-1 transition-colors"
                            >
                              <Printer className="w-3 h-3 text-signal" />
                              <span>{isDestruction ? 'Print Certificate' : 'Print Way Bill'}</span>
                            </button>
                            <span className="text-slate font-mono text-[11px]">
                              {formatDate(rec.date)}
                            </span>
                          </div>
                        </div>

                        <div className="text-slate text-[11px]">
                          <strong>Witnesses / Officers:</strong> {rec.witnesses?.join(', ') || '—'}
                        </div>
                        {rec.remarks && (
                          <div className="text-slate text-[11px]">
                            <strong>Remarks:</strong> {rec.remarks}
                          </div>
                        )}
                        <div className="text-slate text-[10px]">
                          Disposed Items: {rec.item_ids?.length || 0} item(s) &bull; Recorded by: {rec.created_by_name || 'Staff'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate">
                  No destruction or tender release records have been recorded yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Timeline */}
        {activeTab === 'timeline' && (
          <div className="bg-card border border-line rounded-xl p-5 shadow-subtle space-y-4">
            <h2 className="text-sm font-semibold text-ink border-b border-line pb-2">
              Lifecycle Event Log
            </h2>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
              {request.timeline?.map(evt => (
                <div key={evt.id} className="relative text-xs">
                  <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-signal ring-4 ring-card"></span>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{evt.action}</p>
                    <span className="font-mono text-[10px] text-slate">
                      {formatDate(evt.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate mt-0.5">
                    By: <span className="text-ink font-medium">{evt.actor_name}</span> &bull; Status: <span className="uppercase font-mono text-[10px]">{evt.status}</span>
                  </p>
                  {evt.notes && (
                    <p className="p-2 mt-1 bg-surface/50 border border-line rounded text-[11px] text-slate">
                      {evt.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Record Board Appointment */}
      {boardModalOpen && (
        <RecordBoardAppointmentModal
          request={request}
          parentChain={parentChain}
          isOpen={boardModalOpen}
          onClose={() => setBoardModalOpen(false)}
          onSuccess={() => {
            setBoardModalOpen(false);
            fetchRequest();
          }}
        />
      )}

      {/* Modal 2: Record Committee Decision */}
      {committeeModalOpen && (
        <RecordCommitteeDecisionModal
          request={request}
          parentChain={parentChain}
          isOpen={committeeModalOpen}
          onClose={() => setCommitteeModalOpen(false)}
          onSuccess={() => {
            setCommitteeModalOpen(false);
            fetchRequest();
          }}
        />
      )}

      {/* Modal 3: Record Disposal Action */}
      {disposalModalOpen && (
        <RecordDisposalModal
          request={request}
          type={disposalModalType}
          isOpen={disposalModalOpen}
          onClose={() => setDisposalModalOpen(false)}
          onSuccess={() => {
            setDisposalModalOpen(false);
            fetchRequest();
          }}
        />
      )}

      {/* Modal 4: Revert Last Step (Super Admin only) */}
      {revertModalOpen && (
        <RevertStepModal
          request={request}
          isOpen={revertModalOpen}
          onClose={() => setRevertModalOpen(false)}
          onSuccess={() => {
            setRevertModalOpen(false);
            fetchRequest();
          }}
        />
      )}
    </AppShell>
  );
};

// -------------------------------------------------------------
// Modal: Record Board Appointment (3 to 6 members required)
// -------------------------------------------------------------
const RecordBoardAppointmentModal = ({ request, parentChain, isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const isBackdropMouseDownRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const [appointmentDate, setAppointmentDate] = useState(
    request.board?.appointment_date || new Date().toISOString().split('T')[0]
  );
  const [appointedByName, setAppointedByName] = useState(
    request.board?.appointed_by_name || 'Eng.E.K. Indranatha'
  );
  const [members, setMembers] = useState(
    request.board?.members?.length >= 3
      ? request.board.members
      : [
          { name: '', designation: 'Senior Electrical Engineer' },
          { name: '', designation: 'Chief Audit Officer' },
          { name: '', designation: 'Storekeeper' }
        ]
  );
  const [submitting, setSubmitting] = useState(false);

  const handleAddMember = () => {
    if (members.length >= 6) {
      toast.warning('Maximum 6 board members allowed.');
      return;
    }
    setMembers(prev => [...prev, { name: '', designation: '' }]);
  };

  const handleRemoveMember = (idx) => {
    if (members.length <= 3) {
      toast.warning('Board of Survey must have at least 3 members.');
      return;
    }
    setMembers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMemberChange = (idx, field, val) => {
    setMembers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!appointmentDate.trim()) {
      toast.error('Appointment date is required.');
      return;
    }
    if (members.length < 3 || members.length > 6) {
      toast.error('Board of Survey must have between 3 and 6 members.');
      return;
    }
    for (let i = 0; i < members.length; i++) {
      if (!members[i].name.trim()) {
        toast.error(`Member #${i + 1} is missing a name.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/disposal-requests/${request.id}/board-appointment`, {
        appointment_date: appointmentDate.trim(),
        appointed_by_name: appointedByName.trim(),
        members: members.map(m => ({ name: m.name.trim(), designation: m.designation.trim() }))
      });
      if (res.success) {
        toast.success('Board of Survey appointment recorded!');
        onSuccess();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to record board appointment.');
      if (err.message && err.message.toLowerCase().includes('board_appointed')) {
        onSuccess();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { isBackdropMouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (isBackdropMouseDownRef.current && e.target === e.currentTarget) onClose();
        isBackdropMouseDownRef.current = false;
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-card border border-line rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up my-auto shrink-0"
      >
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-signal" />
            <h2 className="text-sm font-semibold text-ink">
              Board of Survey for {request.unit_name || request.unit_id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate hover:text-ink hover:bg-card transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Read-Only Unit / Location Field with Parent Hierarchy */}
          <div className="bg-surface/50 border border-line rounded-lg p-3 space-y-0.5">
            <label className="block text-[11px] font-semibold text-slate">
              Unit / Location (Read-only)
            </label>
            <p className="text-xs font-bold text-ink">{request.unit_name || request.unit_id}</p>
            {parentChain && <p className="text-[10px] text-slate mt-0.5">{parentChain}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Appointment Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Appointed By (DGM)
              </label>
              <input
                type="text"
                value={appointedByName}
                onChange={(e) => setAppointedByName(e.target.value)}
                placeholder="e.g. Eng.E.K. Indranatha"
                className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between border-b border-line pb-1">
              <span className="text-[11px] font-bold text-ink uppercase tracking-wider">
                Committee Members (3 to 6 required)
              </span>
              {members.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="text-signal hover:underline text-[11px] font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Member</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {members.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-mono text-slate text-xs w-4">{idx + 1}.</span>
                  <input
                    type="text"
                    value={m.name}
                    onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                    placeholder="Member full name *"
                    className="flex-1 bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal"
                  />
                  <input
                    type="text"
                    value={m.designation}
                    onChange={(e) => handleMemberChange(idx, 'designation', e.target.value)}
                    placeholder="Designation"
                    className="w-44 bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal"
                  />
                  {members.length > 3 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="text-slate hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-line rounded-lg text-xs font-semibold text-slate hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-signal hover:bg-signal/90 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Board Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

// -------------------------------------------------------------
// Modal: Record Committee Decision (Committee decisions only)
// -------------------------------------------------------------
const RecordCommitteeDecisionModal = ({ request, parentChain, isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const isBackdropMouseDownRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const [reportRef, setReportRef] = useState('');
  const [decisionDate, setDecisionDate] = useState(new Date().toISOString().split('T')[0]);
  const [inspectionDate, setInspectionDate] = useState('');
  const [membersPresent, setMembersPresent] = useState(
    request.board?.members?.map(m => m.name) || []
  );
  const [remarks, setRemarks] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);

  // Per-item decisions map: { [itemId]: { decision, remarks } }
  const [itemDecisions, setItemDecisions] = useState(() => {
    const init = {};
    request.items?.forEach(i => {
      init[i.id] = {
        decision: i.committee_decision_item || '',
        remarks: i.committee_remarks || ''
      };
    });
    return init;
  });

  const [submitting, setSubmitting] = useState(false);

  const handleDecisionChange = (itemId, decision) => {
    setItemDecisions(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), decision }
    }));
  };

  const handleRemarksChange = (itemId, remarksVal) => {
    setItemDecisions(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), remarks: remarksVal }
    }));
  };

  // Helpers: Reject all and Set all to
  const handleRejectAll = () => {
    setItemDecisions(prev => {
      const next = { ...prev };
      request.items?.forEach(i => {
        next[i.id] = { ...(next[i.id] || {}), decision: 'Reject' };
      });
      return next;
    });
    toast.info('All items set to "Reject".');
  };

  const handleSetAllTo = (val) => {
    if (!val) return;
    setItemDecisions(prev => {
      const next = { ...prev };
      request.items?.forEach(i => {
        next[i.id] = { ...(next[i.id] || {}), decision: val };
      });
      return next;
    });
    toast.info(`All items set to "${val}".`);
  };

  const handleToggleMember = (name) => {
    setMembersPresent(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportRef.trim()) {
      toast.error('Committee report reference is required.');
      return;
    }
    if (!decisionDate.trim()) {
      toast.error('Decision date is required.');
      return;
    }
    if (membersPresent.length === 0) {
      toast.error('At least one committee member must be marked present.');
      return;
    }

    // Ensure every single item has a decision
    for (const item of request.items) {
      const dec = itemDecisions[item.id]?.decision;
      if (!dec) {
        toast.error(`Please select a committee decision for "${item.item_name}".`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const itemsPayload = request.items.map(item => ({
        id: item.id,
        committee_decision_item: itemDecisions[item.id].decision,
        committee_remarks: (itemDecisions[item.id].remarks || '').trim()
      }));

      const formData = new FormData();
      formData.append('report_ref', reportRef.trim());
      formData.append('decision_date', decisionDate.trim());
      if (inspectionDate) formData.append('inspection_date', inspectionDate.trim());
      formData.append('remarks', remarks.trim());
      formData.append('members_present', JSON.stringify(membersPresent));
      formData.append('items', JSON.stringify(itemsPayload));

      if (attachmentFile) {
        formData.append('attachment', attachmentFile);
      }

      const res = await api.post(`/disposal-requests/${request.id}/committee-decision`, formData, true);
      if (res.success) {
        toast.success(res.message || 'Committee decision recorded successfully!');
        onSuccess();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to record committee decision.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto no-print animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { isBackdropMouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (isBackdropMouseDownRef.current && e.target === e.currentTarget) onClose();
        isBackdropMouseDownRef.current = false;
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-card border border-line rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[calc(100vh-2.5rem)] max-h-[calc(100dvh-2.5rem)] animate-scale-up shrink-0"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-signal/10 flex items-center justify-center text-signal">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Record Committee Decision</h2>
              <p className="text-[11px] text-slate">Record the Board of Survey inspection findings and per-item disposal decisions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate hover:text-ink hover:bg-card transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Committee Unit Header Banner */}
          <div className="p-3 bg-surface/50 border border-line rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div>
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Committee for:</span>
              <span className="ml-1.5 text-xs font-bold text-ink">{request.unit_name || request.unit_id}</span>
              {parentChain && <p className="text-[10px] text-slate mt-0.5">{parentChain}</p>}
            </div>
            <span className="text-[10px] font-mono text-slate uppercase bg-surface px-2 py-0.5 rounded border border-line self-start sm:self-auto">
              {request.request_no}
            </span>
          </div>

          {/* Top Row: Ref, Decision Date, Inspection Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1.5">
                Committee Report Ref <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={reportRef}
                onChange={(e) => setReportRef(e.target.value)}
                placeholder="e.g. BOS-REP-2026-08"
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1.5">
                Decision Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1.5">
                Inspection Date <span className="text-slate font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal font-mono transition-colors"
              />
            </div>
          </div>

          {/* Members Present */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-ink">
                Members Present <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate">Click to toggle committee attendees</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {request.board?.members?.map((m, idx) => {
                const isSelected = membersPresent.includes(m.name);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleToggleMember(m.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-signal/10 text-signal border-signal/40 font-semibold shadow-xs'
                        : 'bg-surface text-slate border-line hover:text-ink hover:border-slate/40'
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-signal" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-slate/40 inline-block" />
                    )}
                    <span>{m.name}</span>
                    {m.role && <span className="text-[10px] opacity-75">({m.role})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* General Remarks */}
          <div>
            <label className="block text-[11px] font-semibold text-ink mb-1.5">
              General Committee Remarks <span className="text-slate font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Inspected all assets at the IT store; unserviceable equipment recommended for destruction."
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal resize-y transition-colors"
            />
          </div>

          {/* Report Attachment Upload */}
          <div>
            <label className="block text-[11px] font-semibold text-ink mb-1.5">
              Signed Committee Report Scan <span className="text-slate font-normal">(PDF, JPG, or PNG up to 800 KB)</span>
            </label>
            <div className="flex flex-wrap items-center gap-3 p-3 bg-surface/50 border border-line rounded-lg">
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                className="text-xs text-slate file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-card file:text-ink file:shadow-xs hover:file:bg-surface file:cursor-pointer cursor-pointer"
              />
              {attachmentFile && (
                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                  Selected: {attachmentFile.name} ({Math.round(attachmentFile.size / 1024)} KB)
                </span>
              )}
            </div>
          </div>

          {/* Per-Item Decision Section */}
          <div className="space-y-3 pt-3 border-t border-line">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-ink uppercase tracking-wider">
                Per-Item Committee Decisions ({request.items?.length || 0})
              </span>

              {/* Helpers */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRejectAll}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold transition-colors"
                >
                  Reject All
                </button>
                <select
                  onChange={(e) => {
                    handleSetAllTo(e.target.value);
                    e.target.value = '';
                  }}
                  className="bg-surface border border-line rounded-lg px-2.5 py-1 text-[11px] text-ink font-medium focus:outline-none focus:border-signal"
                  defaultValue=""
                >
                  <option value="" disabled>Set all to...</option>
                  <option value="Approve for Destruction">Approve for Destruction</option>
                  <option value="Approve for Tender">Approve for Tender</option>
                  <option value="Retain">Retain</option>
                  <option value="Repair">Repair</option>
                  <option value="Reject">Reject</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {request.items?.map((item, idx) => {
                const dec = itemDecisions[item.id] || {};
                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-surface/40 border border-line rounded-xl space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-signal/10 text-signal text-[10px] font-bold flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-ink text-xs">{item.item_name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface border border-line text-[11px] font-mono text-slate">
                          Qty: {item.quantity}
                        </span>
                        {item.condition_notes && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[11px]">
                            Reason: {item.condition_notes}
                          </span>
                        )}
                      </div>

                      {/* Decision Selector */}
                      <select
                        value={dec.decision || ''}
                        onChange={(e) => handleDecisionChange(item.id, e.target.value)}
                        className={`border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none transition-colors ${
                          dec.decision === 'Approve for Destruction'
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : dec.decision === 'Approve for Tender'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : dec.decision === 'Retain'
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : dec.decision === 'Repair'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : dec.decision === 'Reject'
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : 'bg-surface text-ink border-line'
                        }`}
                      >
                        <option value="">Select Committee Decision *</option>
                        <option value="Approve for Destruction">Approve for Destruction</option>
                        <option value="Approve for Tender">Approve for Tender</option>
                        <option value="Retain">Retain</option>
                        <option value="Repair">Repair</option>
                        <option value="Reject">Reject</option>
                      </select>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={dec.remarks || ''}
                        onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                        placeholder="Committee remarks for this item (optional)..."
                        className="w-full bg-card border border-line rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-slate/60 focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal transition-colors"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-line shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-slate hover:bg-surface hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-signal hover:bg-signal/90 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Recording Decision...' : 'Save Committee Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

// -------------------------------------------------------------
// Modal: Record Destruction or Tender Release
// -------------------------------------------------------------
const RecordDisposalModal = ({ request, type, isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const isBackdropMouseDownRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const isDestruction = type === 'destruction';

  const eligibleItems = request.items?.filter(i => {
    if (i.final_disposition) return false;
    return isDestruction
      ? i.committee_decision_item === 'Approve for Destruction'
      : i.committee_decision_item === 'Approve for Tender';
  }) || [];

  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [waybillNo, setWaybillNo] = useState('');
  const [witnessesText, setWitnessesText] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState(() => eligibleItems.map(i => i.id));
  const [submitting, setSubmitting] = useState(false);

  const handleToggleItem = (id) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reference.trim()) {
      toast.error(`${isDestruction ? 'Destruction certificate' : 'Tender release'} reference is required.`);
      return;
    }
    if (!date.trim()) {
      toast.error('Date is required.');
      return;
    }
    if (!isDestruction && !waybillNo.trim()) {
      toast.error('Way Bill number is required for Tender release.');
      return;
    }
    if (selectedItemIds.length === 0) {
      toast.error('At least one item must be selected.');
      return;
    }

    const witnesses = witnessesText.split(',').map(s => s.trim()).filter(Boolean);

    setSubmitting(true);
    try {
      const payload = {
        type,
        reference: reference.trim(),
        date: date.trim(),
        waybill_no: !isDestruction ? waybillNo.trim() : null,
        item_ids: selectedItemIds,
        witnesses,
        remarks: remarks.trim()
      };

      const res = await api.post(`/disposal-requests/${request.id}/disposal-record`, payload);
      if (res.success) {
        toast.success(res.message || 'Disposal recorded successfully!');
        onSuccess();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to record disposal.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { isBackdropMouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (isBackdropMouseDownRef.current && e.target === e.currentTarget) onClose();
        isBackdropMouseDownRef.current = false;
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-card border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up my-auto shrink-0"
      >
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            {isDestruction ? <Flame className="w-5 h-5 text-rose-600" /> : <Truck className="w-5 h-5 text-emerald-600" />}
            <h2 className="text-sm font-semibold text-ink">
              {isDestruction ? 'Record Asset Destruction' : 'Record Tender Release / Way Bill'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate hover:text-ink hover:bg-card transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                {isDestruction ? 'Certificate Ref' : 'Release Ref'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={isDestruction ? 'e.g. CERT-DEST-2026-01' : 'e.g. TENDER-REL-2026-01'}
                className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Execution Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal font-mono"
              />
            </div>
          </div>

          {!isDestruction && (
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Way Bill Number <span className="text-rose-500">*</span> (Must be unique)
              </label>
              <input
                type="text"
                value={waybillNo}
                onChange={(e) => setWaybillNo(e.target.value)}
                placeholder="e.g. WB-EDL-2026-042"
                className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-ink mb-1">
              Witnesses / Officers Present (Comma separated)
            </label>
            <input
              type="text"
              value={witnessesText}
              onChange={(e) => setWitnessesText(e.target.value)}
              placeholder="e.g. R.K. Bandara, S.D. Wijesinghe"
              className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink mb-1">
              Remarks / Purchaser Details
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={isDestruction ? 'Method of destruction, incinerator location...' : 'Purchaser company name, vehicle number...'}
              className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal resize-y"
            />
          </div>

          {/* Select Items */}
          <div className="space-y-2 pt-2 border-t border-line">
            <span className="text-[11px] font-bold text-ink uppercase tracking-wider">
              Select Items ({selectedItemIds.length}/{eligibleItems.length})
            </span>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {eligibleItems.map(item => {
                const checked = selectedItemIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-surface/50 border border-line rounded cursor-pointer hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleItem(item.id)}
                      className="rounded text-signal"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-ink">{item.item_name}</span>
                      <span className="font-mono text-slate text-[10px] ml-2">Qty: {item.quantity}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-line rounded-lg text-xs font-semibold text-slate hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-1.5 text-white rounded-lg text-xs font-semibold disabled:opacity-50 ${
                isDestruction ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {submitting ? 'Recording...' : 'Record Disposal Execution'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

// -------------------------------------------------------------
// Modal: Super Admin Revert Step
// -------------------------------------------------------------
const RevertStepModal = ({ request, isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const isBackdropMouseDownRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      toast.error('A valid reason (at least 3 characters) is required to revert a step.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/disposal-requests/${request.id}/revert`, { reason: reason.trim() });
      if (res.success) {
        toast.success(res.message || 'Workflow step reverted.');
        onSuccess();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to revert step.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { isBackdropMouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (isBackdropMouseDownRef.current && e.target === e.currentTarget) onClose();
        isBackdropMouseDownRef.current = false;
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-card border border-line rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up my-auto shrink-0"
      >
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <h2 className="text-sm font-semibold text-ink">Revert Workflow Step</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate hover:text-ink hover:bg-card transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
            <strong>Warning:</strong> You are reverting request <strong>{request.request_no}</strong> from <strong>"{request.status}"</strong> to its preceding stage. This will be logged in the audit trail.
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink mb-1">
              Audit Reason for Reversion <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the audit or administrative justification for reverting this step..."
              className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-signal resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-line rounded-lg text-xs font-semibold text-slate hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {submitting ? 'Reverting...' : 'Confirm Revert'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default DisposalRequestDetailPage;

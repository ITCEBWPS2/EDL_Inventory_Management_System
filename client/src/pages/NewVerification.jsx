import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { BackButton } from '../components/common/BackButton';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { DateInput } from '../components/common/DateInput';
import { SerialNumberCell } from '../components/verification/SerialNumberCell';
import { formatDate } from '../utils/formatters';
import { PrintHeader } from '../components/common/PrintHeader';
import { ExportButton } from '../components/ui/ExportButton';
import { Button } from '../components/common/Button';
import {
  isTestToolsAllowed,
  hasTestGeneratedData,
  countTestGeneratedRows,
  generateVerificationTestData,
  clearTestGeneratedData
} from '../utils/verificationTestHelper';
import {
  MapPin,
  ClipboardCheck,
  Printer,
  Save,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Search,
  Filter,
  Check,
  ExternalLink,
  FlaskConical
} from 'lucide-react';

const CONDITION_OPTIONS = ['—', 'Good', 'Damaged'];
const ISSUED_DESTROYED_OPTIONS = ['—', 'Issued', 'Destroyed', 'N/A'];

// Format ISO date-time into DD/MM/YYYY HH:mm
const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

// Check if a row has edits compared to its saved snapshot (or pristine state)
const isRowDirty = (row, saved) => {
  const curPhys = row.physical_qty !== '' && row.physical_qty !== null && !isNaN(Number(row.physical_qty))
    ? Number(row.physical_qty)
    : '';
  const curCond = (row.condition && row.condition !== '—') ? row.condition : '—';
  const curLabel = (row.label_no || '').trim();
  const curRemarks = (row.remarks || '').trim();
  const curIssuedDestroyed = (row.issued_destroyed && row.issued_destroyed !== '—') ? row.issued_destroyed : '—';
  const curIssuedDestroyedQty = (curIssuedDestroyed === 'Issued' || curIssuedDestroyed === 'Destroyed')
    ? (row.issued_destroyed_qty ? Number(row.issued_destroyed_qty) : 1)
    : '';

  if (!saved) {
    return curPhys !== '' || curCond !== '—' || curLabel !== '' || curRemarks !== '' || curIssuedDestroyed !== '—';
  }

  const savedPhys = saved.physical_qty !== '' && saved.physical_qty !== null && !isNaN(Number(saved.physical_qty))
    ? Number(saved.physical_qty)
    : '';
  const savedCond = (saved.condition && saved.condition !== '—') ? saved.condition : '—';
  const savedLabel = (saved.label_no || '').trim();
  const savedRemarks = (saved.remarks || '').trim();
  const savedIssuedDestroyed = (saved.issued_destroyed && saved.issued_destroyed !== '—') ? saved.issued_destroyed : '—';
  const savedIssuedDestroyedQty = (savedIssuedDestroyed === 'Issued' || savedIssuedDestroyed === 'Destroyed')
    ? (saved.issued_destroyed_qty ? Number(saved.issued_destroyed_qty) : 1)
    : '';

  return (
    curPhys !== savedPhys ||
    curCond !== savedCond ||
    curLabel !== savedLabel ||
    curRemarks !== savedRemarks ||
    curIssuedDestroyed !== savedIssuedDestroyed ||
    curIssuedDestroyedQty !== savedIssuedDestroyedQty
  );
};

// Memoized Table Row for smooth typing in large inventory tables
const VerificationRow = memo(({
  row,
  idx,
  searchQuery,
  selectedCategoryFilter,
  onFieldChange,
  onPromptRemove,
  onSaveRow,
  onIssuedDestroyedSelect,
  recordedQty = 0,
  isSaving,
  isDirty,
  isSaved,
  isReadOnly
}) => {
  const hasPhysQty = row.physical_qty !== '' && row.physical_qty !== null && !isNaN(Number(row.physical_qty));
  const diff = hasPhysQty ? Number(row.difference) : null;
  const markedQty = Number(row.issued_destroyed_qty || 1);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isReadOnly && isDirty && !isSaving) {
        onSaveRow(row.originalIndex, row);
      }
    }
  };

  return (
    <tr className="hover:bg-surface/50 transition-colors group">
      {/* 1. No (Plain table cell) */}
      <td
        className="py-2.5 px-3 text-center text-slate font-mono font-medium align-top w-12 min-w-[48px] max-w-[48px] border-r border-line/60"
        style={{ width: '48px', minWidth: '48px', maxWidth: '48px', position: 'static' }}
      >
        {idx + 1}
      </td>

      {/* 2. Serial No. (Plain table cell, w-[420px] min-w-[400px], single line per serial, collapse for batches) */}
      <td
        className="py-2.5 px-3 w-[420px] min-w-[400px] align-top border-r border-line/60"
        style={{ width: '420px', minWidth: '400px', position: 'static' }}
      >
        <SerialNumberCell
          serialNumbers={row.serial_numbers}
          manufacturerSerialNumbers={row.manufacturer_serial_numbers}
          singleSerial={row.item_code}
          singleMfg={row.manufacturer_sn}
          searchQuery={searchQuery}
          resetTrigger={selectedCategoryFilter}
        />
      </td>

      {/* 3. Item (wraps normally, min-w-[170px]) */}
      <td className="py-2.5 px-4 font-semibold text-ink align-top min-w-[170px] leading-snug">
        {row.item_name}
      </td>

      {/* 4. Category */}
      <td className="py-2.5 px-3 text-slate align-top min-w-[130px] leading-snug">
        {row.category}
      </td>

      {/* 5. System Qty (read-only, bold) */}
      <td className="py-2.5 px-3 text-center font-bold text-ink font-mono text-sm align-top whitespace-nowrap min-w-[75px]">
        {row.system_qty}
      </td>

      {/* 6. Physical Qty (numeric input, placeholder "—") */}
      <td className="py-2.5 px-3 text-center align-top whitespace-nowrap min-w-[85px]">
        <input
          type="number"
          min="0"
          placeholder="—"
          value={row.physical_qty ?? ''}
          onChange={(e) => onFieldChange(row.originalIndex, 'physical_qty', e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isReadOnly}
          className="w-18 px-2 py-1 text-center font-mono font-bold bg-surface border border-line rounded text-xs text-ink focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal/30 disabled:opacity-60"
        />
      </td>

      {/* 7. Difference (auto-calculated, color-coded) */}
      <td className="py-2.5 px-3 text-center font-mono font-bold align-top whitespace-nowrap min-w-[75px]">
        {diff === null ? (
          <span className="text-slate font-normal">—</span>
        ) : diff === 0 ? (
          <span className="text-[#2F7A5C]">0</span>
        ) : (
          <span className="text-[#B4483A]">{diff > 0 ? `+${diff}` : diff}</span>
        )}
      </td>

      {/* 8. Condition (dropdown) */}
      <td className="py-2.5 px-3 align-top whitespace-nowrap min-w-[105px]">
        <select
          value={row.condition || '—'}
          onChange={(e) => onFieldChange(row.originalIndex, 'condition', e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isReadOnly}
          className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none focus:border-signal cursor-pointer disabled:opacity-60"
        >
          {CONDITION_OPTIONS.map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </td>

      {/* 9. Issued / Destroyed (dropdown + Qty input + status line) */}
      <td className="py-2.5 px-3 align-top whitespace-nowrap min-w-[210px] w-[220px]">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <select
              value={row.issued_destroyed || '—'}
              onChange={(e) => onIssuedDestroyedSelect(row.originalIndex, row, e.target.value)}
              disabled={isReadOnly}
              className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none focus:border-signal cursor-pointer disabled:opacity-60 flex-1 min-w-[100px]"
            >
              {ISSUED_DESTROYED_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {(row.issued_destroyed === 'Issued' || row.issued_destroyed === 'Destroyed') && (
              <div className="flex items-center gap-1 shrink-0" title="Quantity marked as Issued / Destroyed">
                <span className="text-[10px] text-slate font-medium">Qty:</span>
                <input
                  type="number"
                  min="1"
                  max={row.system_qty || 1}
                  value={row.issued_destroyed_qty ?? 1}
                  onChange={(e) => onFieldChange(row.originalIndex, 'issued_destroyed_qty', e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isReadOnly}
                  className="w-[52px] px-1 py-1 text-center font-mono font-bold bg-surface border border-line rounded text-xs text-ink focus:outline-none focus:border-signal disabled:opacity-60"
                />
              </div>
            )}
          </div>

          {(row.issued_destroyed === 'Issued' || row.issued_destroyed === 'Destroyed') && (
            <div className="flex items-center gap-1 text-[11px] pt-0.5">
              {recordedQty >= markedQty ? (
                <span className="inline-flex items-center gap-1 font-semibold text-[#2F7A5C] bg-[#2F7A5C]/10 border border-[#2F7A5C]/20 px-1.5 py-0.5 rounded text-[10px]">
                  <Check className="w-3 h-3 text-[#2F7A5C]" />
                  <span>Recorded</span>
                </span>
              ) : recordedQty > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  <span>Recorded {recordedQty} of {markedQty}</span>
                </span>
              ) : (
                <span className="text-slate/80 text-[10px] italic">
                  Pending record
                </span>
              )}
            </div>
          )}
        </div>
      </td>

      {/* 10. Label No (text input, placeholder "VL-0000") */}
      <td className="py-2.5 px-3 align-top min-w-[95px] whitespace-nowrap">
        <input
          type="text"
          placeholder="VL-0000"
          value={row.label_no || ''}
          onChange={(e) => onFieldChange(row.originalIndex, 'label_no', e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isReadOnly}
          className="w-22 px-2 py-1 font-mono text-xs bg-surface border border-line rounded text-ink placeholder-slate focus:outline-none focus:border-signal disabled:opacity-60"
        />
      </td>

      {/* 11. Remarks (optional text input) */}
      <td className="py-2.5 px-4 align-top min-w-[140px]">
        <input
          type="text"
          placeholder="Optional remarks"
          value={row.remarks || ''}
          onChange={(e) => onFieldChange(row.originalIndex, 'remarks', e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isReadOnly}
          className="w-full min-w-[120px] px-2 py-1 text-xs bg-surface border border-line rounded text-ink placeholder-slate focus:outline-none focus:border-signal disabled:opacity-60"
        />
      </td>

      {/* 12. Actions: Per-row Save Button + Remove "X" Button */}
      <td className="py-2.5 px-3 align-top min-w-[120px] whitespace-nowrap">
        <div className="flex items-center justify-center gap-1.5">
          {/* Status / Save Action */}
          {isSaving ? (
            <div className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate bg-surface rounded">
              <div className="w-3.5 h-3.5 border-2 border-line border-t-signal rounded-full animate-spin"></div>
              <span className="hidden sm:inline">Saving</span>
            </div>
          ) : isDirty ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes"></span>
              <button
                type="button"
                onClick={() => onSaveRow(row.originalIndex, row)}
                disabled={isReadOnly}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-signal hover:bg-[#1f406b] rounded shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Save this row to draft (Enter)"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save</span>
              </button>
            </div>
          ) : isSaved ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2F7A5C] bg-[#2F7A5C]/10 border border-[#2F7A5C]/20 px-2 py-0.5 rounded shadow-2xs"
              title="Row saved to draft"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7A5C]" />
              <span className="hidden sm:inline">Saved</span>
            </span>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate/40 bg-surface/50 border border-line/40 rounded cursor-not-allowed opacity-50"
              title="No changes to save"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </button>
          )}

          {/* Remove "x" Button */}
          <button
            type="button"
            onClick={() => onPromptRemove(row.originalIndex, row)}
            disabled={isReadOnly}
            className="p-1 text-slate hover:text-[#B4483A] rounded transition-colors cursor-pointer disabled:opacity-40"
            title="Remove item from verification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export const NewVerification = () => {
  const { user, selectedUnitId, selectedUnit } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const tableContainerRef = useRef(null);

  const isReadOnly = user?.role === 'read_only';

  // Step 1: Entry Form | Step 2: Review & Confirm
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isExistingConfirmed, setIsExistingConfirmed] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [verifier1, setVerifier1] = useState('');
  const [verifier2, setVerifier2] = useState('');
  const [verifier3, setVerifier3] = useState('');

  // Table items & draft tracking
  const [items, setItems] = useState([]);
  const [draftInfo, setDraftInfo] = useState(null); // { id, updated_at, savedCount }
  const [savedSnapshots, setSavedSnapshots] = useState({}); // { [itemId]: { physical_qty, condition, label_no, remarks, issued_destroyed } }
  const [savingRows, setSavingRows] = useState({}); // { [itemId]: boolean }
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const [errors, setErrors] = useState({});

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Modals state
  const [itemToRemove, setItemToRemove] = useState(null);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isCancelDraftModalOpen, setIsCancelDraftModalOpen] = useState(false);
  const cancelDraftBackdropRef = useRef(false);
  const [isUnsavedLeaveModalOpen, setIsUnsavedLeaveModalOpen] = useState(false);
  const [issuedDestroyedRecords, setIssuedDestroyedRecords] = useState([]);

  // Testing Helper State (Dev / Super & Local Admin only)
  const isDevTestingAllowed = useMemo(() => isTestToolsAllowed(user), [user]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const testModalBackdropRef = useRef(false);
  const [testScope, setTestScope] = useState('visible'); // 'visible' | 'all'
  const [testOnlyEmpty, setTestOnlyEmpty] = useState(true);
  const [testPattern, setTestPattern] = useState('realistic'); // 'realistic' | 'all_matched' | 'shortages_excess'
  const [testPercentage, setTestPercentage] = useState(100);
  const [testFillHeaders, setTestFillHeaders] = useState(false);

  // In-memory test tracking (no DB writes)
  const [testDataBackup, setTestDataBackup] = useState(null); // backup of items before test fill
  const [testGeneratedIndices, setTestGeneratedIndices] = useState(new Set());
  const [testHeaderBackup, setTestHeaderBackup] = useState(null);

  // Safety confirmation modal if submitting with test data
  const [isTestDataSafetyModalOpen, setIsTestDataSafetyModalOpen] = useState(false);
  const [pendingSubmitAction, setPendingSubmitAction] = useState(null);

  // Auto-sync year when date changes
  const handleDateChange = (e) => {
    const val = e.target.value;
    setDate(val);
    if (val && /^\d{4}/.test(val)) {
      const parsedYear = parseInt(val.split('-')[0], 10);
      if (!isNaN(parsedYear)) {
        setYear(parsedYear);
      }
    }
    if (errors.date) {
      setErrors(prev => ({ ...prev, date: null }));
    }
  };

  // Effective unit id (falls back to user's assigned unit or default Homagama unit)
  const effectiveUnitId = selectedUnitId || user?.units?.[0]?.id || '11111111-1111-1111-1111-111111111145';

  // Location display string
  const locationDisplay = selectedUnit?.unit_name
    ? `${selectedUnit.unit_name}${selectedUnit.unit_code ? ` (${selectedUnit.unit_code})` : ''}`
    : 'All Units (CSC_HOMAGAMA)';

  // Load items or existing verification record and merge active draft if present
  const loadInitialData = async () => {
    setLoading(true);
    setErrors({});
    try {
      // Always fetch existing issued/destroyed records for status calculation
      const idRes = await api.get('/verifications/issued-destroyed', { unit_id: effectiveUnitId }).catch(() => null);
      setIssuedDestroyedRecords(idRes?.success && Array.isArray(idRes.data) ? idRes.data : []);

      if (editId) {
        // Loading existing verification (e.g. view from history)
        const res = await api.get(`/verifications/${editId}`);
        if (res.success && res.data) {
          const v = res.data;
          setDate(v.date || new Date().toISOString().split('T')[0]);
          setYear(v.year || new Date().getFullYear());

          const vList = [v.verifier_1, v.verifier_2, v.verifier_3].filter(Boolean);
          if (vList.length === 0 && Array.isArray(v.verified_by)) {
            vList.push(...v.verified_by);
          }
          setVerifier1(v.verifier_1 || vList[0] || '');
          setVerifier2(v.verifier_2 || vList[1] || '');
          setVerifier3(v.verifier_3 || vList[2] || '');

          const snapshots = {};
          const loadedItems = (v.items || []).map(item => {
            const serials = (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0)
              ? item.serial_numbers
              : (item.item_code ? [item.item_code] : []);
            const mfgs = (Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.length > 0)
              ? item.manufacturer_serial_numbers
              : (item.manufacturer_sn ? [item.manufacturer_sn] : []);

            const itemId = item.item_id || item.id;
            const issuedDestroyedVal = item.issued_destroyed || item.disposition || '—';
            const issuedDestroyedQtyVal = (issuedDestroyedVal === 'Issued' || issuedDestroyedVal === 'Destroyed')
              ? (item.issued_destroyed_qty !== null && item.issued_destroyed_qty !== undefined ? Number(item.issued_destroyed_qty) : 1)
              : null;

            snapshots[itemId] = {
              physical_qty: item.physical_qty !== null && item.physical_qty !== undefined ? item.physical_qty : '',
              condition: item.condition || '—',
              issued_destroyed: issuedDestroyedVal,
              issued_destroyed_qty: issuedDestroyedQtyVal,
              label_no: item.label_no || '',
              remarks: item.remarks || ''
            };

            return {
              id: item.id,
              inventory_item_id: item.item_id || null,
              item_code: item.item_code || (serials[0] || ''),
              serial_numbers: serials,
              manufacturer_sn: item.manufacturer_sn || (mfgs[0] || ''),
              manufacturer_serial_numbers: mfgs,
              is_batch: Boolean(item.is_batch) || serials.length > 1,
              item_name: item.item_name || '',
              category: item.category || 'General',
              sub_type: item.sub_type || '',
              system_qty: Number(item.system_qty || 0),
              physical_qty: item.physical_qty !== null && item.physical_qty !== undefined ? item.physical_qty : '',
              difference: item.difference !== undefined ? item.difference : null,
              condition: item.condition || '—',
              issued_destroyed: issuedDestroyedVal,
              issued_destroyed_qty: issuedDestroyedQtyVal,
              issued_destroyed_id: item.issued_destroyed_id || null,
              label_no: item.label_no || '',
              remarks: item.remarks || '',
              status: item.status || 'Not Counted'
            };
          });
          setItems(loadedItems);
          setSavedSnapshots(snapshots);

          if (v.status === 'confirmed') {
            setIsExistingConfirmed(true);
            setCurrentStep(2); // Jump directly to Review & Confirm screen
          }
        }
      } else {
        // New verification: 1. Fetch inventory items for active unit
        const [unitRes, draftRes] = await Promise.all([
          api.get('/verifications/inventory-items', { unit_id: effectiveUnitId }),
          api.get('/verifications/draft', { unit_id: effectiveUnitId }).catch(() => null)
        ]);

        let baseItems = [];
        if (unitRes?.success && Array.isArray(unitRes.data)) {
          baseItems = unitRes.data.map((r, idx) => ({
            id: r.id || `inv-${idx}-${r.inventory_item_id}`,
            inventory_item_id: r.inventory_item_id || r.item_id,
            item_code: r.item_code || '',
            serial_numbers: Array.isArray(r.serial_numbers) ? r.serial_numbers : (r.item_code ? [r.item_code] : []),
            manufacturer_sn: r.manufacturer_sn || '',
            manufacturer_serial_numbers: Array.isArray(r.manufacturer_serial_numbers) ? r.manufacturer_serial_numbers : (r.manufacturer_sn ? [r.manufacturer_sn] : []),
            is_batch: Boolean(r.is_batch),
            item_name: r.item_name || 'Unnamed Item',
            category: r.category || 'General',
            sub_type: r.sub_type || '',
            system_qty: Number(r.system_qty || 0),
            physical_qty: '',
            difference: null,
            condition: '—',
            issued_destroyed: '—',
            issued_destroyed_qty: null,
            issued_destroyed_id: null,
            label_no: '',
            remarks: '',
            status: 'Not Counted'
          }));
        }

        // 2. Merge draft items if active draft exists
        const draft = draftRes?.data;
        const snapshots = {};

        if (draft && draft.id) {
          setDraftInfo({
            id: draft.id,
            updated_at: draft.updated_at,
            savedCount: (draft.items || []).length
          });

          if (draft.date) setDate(draft.date);
          if (draft.year) setYear(draft.year);
          if (draft.verifier_1) setVerifier1(draft.verifier_1);
          if (draft.verifier_2) setVerifier2(draft.verifier_2);
          if (draft.verifier_3) setVerifier3(draft.verifier_3);

          const draftItemsMap = new Map((draft.items || []).map(it => [it.item_id, it]));

          baseItems = baseItems.map(row => {
            const itemId = row.inventory_item_id;
            if (draftItemsMap.has(itemId)) {
              const dItem = draftItemsMap.get(itemId);
              const phys = dItem.physical_qty !== null && dItem.physical_qty !== undefined ? dItem.physical_qty : '';
              const cond = dItem.condition || '—';
              const issuedDestroyed = dItem.issued_destroyed || dItem.disposition || '—';
              const issuedDestroyedQty = (issuedDestroyed === 'Issued' || issuedDestroyed === 'Destroyed')
                ? (dItem.issued_destroyed_qty !== null && dItem.issued_destroyed_qty !== undefined ? Number(dItem.issued_destroyed_qty) : 1)
                : null;
              const label = dItem.label_no || '';
              const rem = dItem.remarks || '';

              snapshots[itemId] = {
                physical_qty: phys,
                condition: cond,
                issued_destroyed: issuedDestroyed,
                issued_destroyed_qty: issuedDestroyedQty,
                label_no: label,
                remarks: rem
              };

              return {
                ...row,
                physical_qty: phys,
                difference: dItem.difference !== undefined ? dItem.difference : null,
                condition: cond,
                issued_destroyed: issuedDestroyed,
                issued_destroyed_qty: issuedDestroyedQty,
                issued_destroyed_id: dItem.issued_destroyed_id || null,
                label_no: label,
                remarks: rem,
                status: dItem.status || 'Not Counted'
              };
            }
            return row;
          });
        } else {
          setDraftInfo(null);
        }

        setItems(baseItems);
        setSavedSnapshots(snapshots);
      }
    } catch (err) {
      console.error('Failed to load verification items:', err);
      toast.error('Failed to initialize verification items.');
    } finally {
      setLoading(false);
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollLeft = 0;
      }
    }
  };

  useEffect(() => {
    setSearchQuery('');
    setSelectedCategoryFilter('');
    loadInitialData();
  }, [editId, effectiveUnitId]);

  // Reset table horizontal scroll strictly to left edge when page loads, step changes or filters change
  useEffect(() => {
    const el = tableContainerRef.current;
    if (el) {
      el.scrollLeft = 0;
      requestAnimationFrame(() => {
        if (el) el.scrollLeft = 0;
      });
    }
  }, [loading, currentStep, selectedCategoryFilter, searchQuery]);

  // Check if test-generated data is active
  const hasTestData = useMemo(() => {
    return hasTestGeneratedData(items, testGeneratedIndices);
  }, [items, testGeneratedIndices]);

  const testFilledCount = useMemo(() => {
    return countTestGeneratedRows(items, testGeneratedIndices);
  }, [items, testGeneratedIndices]);

  // Fill test data handler (in-memory only, no DB writes)
  const handleFillTestData = () => {
    const targetOriginalIndices = testScope === 'visible'
      ? filteredItems.map(row => row.originalIndex)
      : items.map((_, idx) => idx);

    // Snapshot current state before applying test data (only if we don't already have one)
    if (!testDataBackup) {
      setTestDataBackup(items.map(it => ({ ...it })));
    }

    if (testFillHeaders) {
      setTestHeaderBackup({
        verifier1,
        verifier2,
        verifier3
      });
      setVerifier1('Test Verifier 1');
      setVerifier2('Test Verifier 2');
      setVerifier3('Test Verifier 3');
      if (errors.verifier1) {
        setErrors(prev => ({ ...prev, verifier1: null }));
      }
    }

    const { updatedItems, modifiedIndices } = generateVerificationTestData({
      items,
      targetIndices: targetOriginalIndices,
      pattern: testPattern,
      onlyEmpty: testOnlyEmpty,
      percentage: testPercentage,
      startLabelSeq: 1
    });

    setTestGeneratedIndices(modifiedIndices);
    setItems(updatedItems);
    setIsTestModalOpen(false);
    toast.info(`Filled test data into ${modifiedIndices.size} rows (in-memory only).`);
  };

  // Clear test data handler
  const handleClearTestData = async () => {
    // 1. Restore/clear in-memory line items
    const restoredItems = clearTestGeneratedData(items, testDataBackup, testGeneratedIndices);
    setItems(restoredItems);

    // 2. Clean savedSnapshots of any test items so they don't show as dirty or get re-saved
    setSavedSnapshots(prev => {
      const updated = { ...prev };
      items.forEach(it => {
        const itemId = it.inventory_item_id || it.item_id || it.id;
        const snap = updated[itemId];
        const isTest = it.__isTestGenerated ||
          String(it.label_no || '').trim().startsWith('TEST-') ||
          (snap && String(snap.label_no || '').trim().startsWith('TEST-'));
        if (isTest && itemId) {
          delete updated[itemId];
        }
      });
      return updated;
    });

    // 3. Clear verifiers if they were test verifiers
    if (verifier1?.startsWith('Test Verifier') || verifier1 === 'Test Verifier 1') {
      setVerifier1(testHeaderBackup?.verifier1 || '');
    }
    if (verifier2?.startsWith('Test Verifier') || verifier2 === 'Test Verifier 2') {
      setVerifier2(testHeaderBackup?.verifier2 || '');
    }
    if (verifier3?.startsWith('Test Verifier') || verifier3 === 'Test Verifier 3') {
      setVerifier3(testHeaderBackup?.verifier3 || '');
    }
    setTestHeaderBackup(null);

    setTestGeneratedIndices(new Set());
    setTestDataBackup(null);

    // 4. If an active draft on the backend has test items, clear them from the server draft as well
    if (draftInfo?.id) {
      try {
        const res = await api.delete('/verifications/draft/test-items', { unit_id: effectiveUnitId }).catch(() => null);
        if (res?.success) {
          setDraftInfo(prev => prev ? {
            ...prev,
            savedCount: res.remainingCount !== undefined ? res.remainingCount : prev.savedCount
          } : null);
        }
      } catch (err) {
        console.warn('Could not clear test items from backend draft:', err);
      }
    }

    toast.info('Test data cleared.');
  };

  // Distinct categories for filter dropdown
  const distinctCategories = useMemo(() => {
    const set = new Set();
    items.forEach(i => {
      if (i.category && i.category.trim()) {
        set.add(i.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  // Dirty count and unsaved changes check
  const dirtyRows = useMemo(() => {
    return items.filter(row => {
      const itemId = row.inventory_item_id || row.item_id || row.id;
      return isRowDirty(row, savedSnapshots[itemId]);
    });
  }, [items, savedSnapshots]);

  const hasUnsavedChanges = dirtyRows.length > 0;

  // Window beforeunload guard
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved rows. Save them first or leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Filtered view of items (retains originalIndex to allow in-place editing)
  const filteredItems = useMemo(() => {
    return items
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .filter(row => {
        if (selectedCategoryFilter && (row.category || '').toLowerCase() !== selectedCategoryFilter.toLowerCase()) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const serialMatch = (row.item_code || '').toLowerCase().includes(q);
          const anySerialMatch = Array.isArray(row.serial_numbers) && row.serial_numbers.some(s => s && s.toLowerCase().includes(q));
          const nameMatch = (row.item_name || '').toLowerCase().includes(q);
          const mfgMatch = (row.manufacturer_sn || '').toLowerCase().includes(q);
          const anyMfgMatch = Array.isArray(row.manufacturer_serial_numbers) && row.manufacturer_serial_numbers.some(m => m && m.toLowerCase().includes(q));
          if (!serialMatch && !anySerialMatch && !nameMatch && !mfgMatch && !anyMfgMatch) return false;
        }
        return true;
      });
  }, [items, selectedCategoryFilter, searchQuery]);

  // Recorded quantities map from active unit's existing Issued / Destroyed records
  const recordedQtyMap = useMemo(() => {
    const map = {};
    (issuedDestroyedRecords || []).forEach(rec => {
      const itemId = rec.item_id;
      if (itemId) {
        map[itemId] = (map[itemId] || 0) + (Number(rec.quantity) || 0);
      }
    });
    return map;
  }, [issuedDestroyedRecords]);

  // Handle line item field changes
  const handleItemFieldChange = useCallback((index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };

      if (field === 'physical_qty') {
        const valStr = String(value).trim();
        if (valStr === '' || isNaN(Number(valStr))) {
          target.physical_qty = '';
          target.difference = null;
          target.status = 'Not Counted';
        } else {
          const phys = Number(valStr);
          const sys = Number(target.system_qty || 0);
          const diff = phys - sys;
          target.physical_qty = phys;
          target.difference = diff;
          if (diff === 0) target.status = 'Matched';
          else if (diff < 0) target.status = 'Shortage';
          else target.status = 'Excess';
        }
      }

      if (field === 'issued_destroyed_qty') {
        const valStr = String(value).trim();
        if (valStr === '') {
          target.issued_destroyed_qty = '';
        } else {
          const parsed = parseInt(valStr, 10);
          target.issued_destroyed_qty = isNaN(parsed) ? '' : Math.max(1, Math.min(Number(target.system_qty || 1), parsed));
        }
      }

      copy[index] = target;
      return copy;
    });

    if (errors.items) {
      setErrors(prev => ({ ...prev, items: null }));
    }
  }, [errors.items]);

  // Per-row Save Handler
  const handleSaveRow = useCallback(async (originalIndex, row) => {
    if (isReadOnly) return;
    const itemId = row.inventory_item_id || row.item_id || row.id;
    if (!itemId) return;

    if (row.physical_qty !== '' && row.physical_qty !== null && Number(row.physical_qty) < 0) {
      toast.error('Physical quantity cannot be negative.');
      return;
    }

    if (row.issued_destroyed === 'Issued' || row.issued_destroyed === 'Destroyed') {
      const q = Number(row.issued_destroyed_qty);
      if (!row.issued_destroyed_qty || isNaN(q) || q < 1 || q > Number(row.system_qty || 1)) {
        toast.error(`Issued/Destroyed quantity for "${row.item_name}" must be between 1 and ${row.system_qty || 1}.`);
        return;
      }
    }

    const issuedDestroyedQtyToSave = (row.issued_destroyed === 'Issued' || row.issued_destroyed === 'Destroyed')
      ? Number(row.issued_destroyed_qty || 1)
      : null;

    setSavingRows(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await api.put(`/verifications/draft/items/${itemId}`, {
        unit_id: effectiveUnitId,
        rowData: {
          item_id: itemId,
          inventory_item_id: row.inventory_item_id,
          item_name: row.item_name,
          category: row.category,
          sub_type: row.sub_type,
          item_code: row.item_code,
          serial_numbers: row.serial_numbers,
          manufacturer_sn: row.manufacturer_sn,
          manufacturer_serial_numbers: row.manufacturer_serial_numbers,
          is_batch: row.is_batch,
          system_qty: row.system_qty,
          physical_qty: row.physical_qty,
          condition: row.condition,
          issued_destroyed: row.issued_destroyed,
          issued_destroyed_qty: issuedDestroyedQtyToSave,
          issued_destroyed_id: row.issued_destroyed_id,
          label_no: (row.label_no || '').trim(),
          remarks: (row.remarks || '').trim(),
          status: row.status
        },
        headerData: {
          date,
          year: Number(year),
          verifier_1: verifier1.trim(),
          verifier_2: verifier2.trim(),
          verifier_3: verifier3.trim()
        }
      });

      if (res.success) {
        setSavedSnapshots(prev => ({
          ...prev,
          [itemId]: {
            physical_qty: row.physical_qty,
            condition: row.condition,
            issued_destroyed: row.issued_destroyed,
            issued_destroyed_qty: issuedDestroyedQtyToSave,
            label_no: row.label_no,
            remarks: row.remarks
          }
        }));
        setDraftInfo(prev => ({
          id: res.data?.draft?.id || prev?.id,
          updated_at: res.data?.draft?.updated_at || new Date().toISOString(),
          savedCount: (prev?.savedCount || 0) + (savedSnapshots[itemId] ? 0 : 1)
        }));
        toast.success(`Saved "${row.item_name}" to draft.`);
      }
    } catch (err) {
      console.error('Failed to save row to draft:', err);
      toast.error(err.message || 'Failed to save row to draft.');
    } finally {
      setSavingRows(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }, [isReadOnly, effectiveUnitId, date, year, verifier1, verifier2, verifier3, savedSnapshots, toast]);

  // Issued / Destroyed Selection Handler (No popup, no auto-navigate, just updates state)
  const handleIssuedDestroyedSelect = useCallback((originalIndex, row, value) => {
    if (isReadOnly) return;
    const isMarked = value === 'Issued' || value === 'Destroyed';
    const defaultQty = isMarked ? (Number(row.issued_destroyed_qty) || 1) : null;

    setItems(prev => {
      const copy = [...prev];
      copy[originalIndex] = {
        ...copy[originalIndex],
        issued_destroyed: value,
        issued_destroyed_qty: defaultQty
      };
      return copy;
    });

    if (errors.items) {
      setErrors(prev => ({ ...prev, items: null }));
    }
  }, [isReadOnly, errors.items]);

  // Save All Unsaved Rows
  const handleSaveAll = async () => {
    if (isReadOnly) return;
    if (dirtyRows.length === 0) {
      toast.info('No unsaved changes to save.');
      return;
    }

    // Validate rows
    for (const row of dirtyRows) {
      if (row.physical_qty !== '' && row.physical_qty !== null && Number(row.physical_qty) < 0) {
        toast.error(`Physical quantity cannot be negative for ${row.item_name}.`);
        return;
      }
      if (row.issued_destroyed === 'Issued' || row.issued_destroyed === 'Destroyed') {
        const q = Number(row.issued_destroyed_qty);
        if (!row.issued_destroyed_qty || isNaN(q) || q < 1 || q > Number(row.system_qty || 1)) {
          toast.error(`Issued/Destroyed quantity for "${row.item_name}" must be between 1 and ${row.system_qty || 1}.`);
          return;
        }
      }
    }

    setIsSavingAll(true);
    try {
      const res = await api.post('/verifications/draft/save-all', {
        unit_id: effectiveUnitId,
        items: dirtyRows.map(row => ({
          item_id: row.inventory_item_id || row.item_id || row.id,
          inventory_item_id: row.inventory_item_id,
          item_name: row.item_name,
          category: row.category,
          sub_type: row.sub_type,
          item_code: row.item_code,
          serial_numbers: row.serial_numbers,
          manufacturer_sn: row.manufacturer_sn,
          manufacturer_serial_numbers: row.manufacturer_serial_numbers,
          is_batch: row.is_batch,
          system_qty: row.system_qty,
          physical_qty: row.physical_qty,
          condition: row.condition,
          issued_destroyed: row.issued_destroyed,
          issued_destroyed_qty: (row.issued_destroyed === 'Issued' || row.issued_destroyed === 'Destroyed') ? Number(row.issued_destroyed_qty || 1) : null,
          issued_destroyed_id: row.issued_destroyed_id,
          label_no: (row.label_no || '').trim(),
          remarks: (row.remarks || '').trim(),
          status: row.status
        })),
        headerData: {
          date,
          year: Number(year),
          verifier_1: verifier1.trim(),
          verifier_2: verifier2.trim(),
          verifier_3: verifier3.trim()
        }
      });

      if (res.success) {
        const newSnapshots = { ...savedSnapshots };
        dirtyRows.forEach(row => {
          const itemId = row.inventory_item_id || row.item_id || row.id;
          newSnapshots[itemId] = {
            physical_qty: row.physical_qty,
            condition: row.condition,
            issued_destroyed: row.issued_destroyed,
            issued_destroyed_qty: (row.issued_destroyed === 'Issued' || row.issued_destroyed === 'Destroyed') ? Number(row.issued_destroyed_qty || 1) : null,
            label_no: row.label_no,
            remarks: row.remarks
          };
        });
        setSavedSnapshots(newSnapshots);
        setDraftInfo(prev => ({
          id: res.data?.draft?.id || prev?.id,
          updated_at: res.data?.draft?.updated_at || new Date().toISOString(),
          savedCount: Object.keys(newSnapshots).length
        }));
        toast.success(`${res.data?.savedCount || dirtyRows.length} rows saved to draft.`);
      }
    } catch (err) {
      console.error('Failed to save all dirty items:', err);
      toast.error(err.message || 'Failed to save items to draft.');
    } finally {
      setIsSavingAll(false);
    }
  };

  // Discard draft confirmation handler
  const handleConfirmDiscardDraft = async () => {
    setIsDiscarding(true);
    try {
      const res = await api.delete('/verifications/draft', { unit_id: effectiveUnitId });
      if (res.success) {
        toast.success('Draft verification discarded.');
        setDraftInfo(null);
        setSavedSnapshots({});
        setTestDataBackup(null);
        setTestGeneratedIndices(new Set());
        setIsDiscardModalOpen(false);
        await loadInitialData();
      }
    } catch (err) {
      console.error('Failed to discard draft:', err);
      toast.error(err.message || 'Failed to discard draft.');
    } finally {
      setIsDiscarding(false);
    }
  };

  // Prompt remove row confirmation modal
  const handlePromptRemoveRow = useCallback((index, item) => {
    setItemToRemove({ index, item });
  }, []);

  // Confirmed removal of line item
  const handleConfirmRemoveRow = () => {
    if (itemToRemove !== null) {
      setItems(prev =>
        prev.filter((item, i) => {
          if (itemToRemove.item?.id && item.id) {
            return item.id !== itemToRemove.item.id;
          }
          return i !== itemToRemove.index;
        })
      );
      setItemToRemove(null);
    }
  };

  // Step 1 Validation & Proceed to Step 2
  const handleSubmitToReview = (e) => {
    if (e) e.preventDefault();
    const newErrors = {};

    if (!date) {
      newErrors.date = 'Date is required.';
    }

    if (!verifier1 || !verifier1.trim()) {
      newErrors.verifier1 = 'Verifier 1 name is required.';
    }

    if (items.length === 0) {
      newErrors.items = 'No inventory items available to verify for this unit.';
    } else {
      const hasAtLeastOneCounted = items.some(
        item => item.physical_qty !== '' && item.physical_qty !== null && !isNaN(Number(item.physical_qty))
      );
      if (!hasAtLeastOneCounted) {
        newErrors.items = 'At least one item must have a Physical Quantity entered before proceeding.';
      }

      // Check Issued / Destroyed quantities
      for (const item of items) {
        if (item.issued_destroyed === 'Issued' || item.issued_destroyed === 'Destroyed') {
          const q = Number(item.issued_destroyed_qty);
          if (!item.issued_destroyed_qty || isNaN(q) || q < 1 || q > Number(item.system_qty || 1)) {
            newErrors.items = `Please specify a valid quantity (1 to ${item.system_qty || 1}) for ${item.item_name} marked as ${item.issued_destroyed}.`;
            break;
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please complete the required verification fields.');
      return;
    }

    const proceedToReview = () => {
      setErrors({});
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (hasTestData) {
      setPendingSubmitAction(() => proceedToReview);
      setIsTestDataSafetyModalOpen(true);
      return;
    }

    proceedToReview();
  };

  // Step 2 Confirm Verification and save to database permanently
  const handleConfirmVerification = async (forceBypassSafety = false) => {
    if (!forceBypassSafety && hasTestData) {
      setPendingSubmitAction(() => () => handleConfirmVerification(true));
      setIsTestDataSafetyModalOpen(true);
      return;
    }

    if (isExistingConfirmed) {
      navigate('/verification/history');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        unit_id: effectiveUnitId,
        date,
        year: Number(year),
        verifier_1: verifier1.trim(),
        verifier_2: verifier2.trim(),
        verifier_3: verifier3.trim(),
        verified_by: [verifier1, verifier2, verifier3].map(v => v.trim()).filter(Boolean),
        status: 'confirmed',
        summary: `Annual Physical Count for ${locationDisplay} - ${year}`,
        items: items.map(item => {
          const sys = Number(item.system_qty || 0);
          const hasPhys = item.physical_qty !== '' && item.physical_qty !== null;
          const phys = hasPhys ? Number(item.physical_qty) : null;
          const diff = phys !== null ? phys - sys : 0;

          let status = item.status;
          if (!status || status === 'Not Counted') {
            if (phys === null) status = 'Not Counted';
            else if (diff === 0) status = 'Matched';
            else if (diff < 0) status = 'Shortage';
            else status = 'Excess';
          }

          return {
            item_id: item.inventory_item_id || item.item_id || (typeof item.id === 'string' && item.id.match(/^[0-9a-f-]{36}$/i) ? item.id : null),
            item_code: item.item_code || (item.serial_numbers && item.serial_numbers[0]) || '',
            serial_numbers: Array.isArray(item.serial_numbers) ? item.serial_numbers : (item.item_code ? [item.item_code] : []),
            manufacturer_sn: item.manufacturer_sn || (item.manufacturer_serial_numbers && item.manufacturer_serial_numbers[0]) || '',
            manufacturer_serial_numbers: Array.isArray(item.manufacturer_serial_numbers) ? item.manufacturer_serial_numbers : (item.manufacturer_sn ? [item.manufacturer_sn] : []),
            is_batch: Boolean(item.is_batch) || (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 1),
            item_name: item.item_name,
            category: item.category,
            system_qty: sys,
            physical_qty: phys,
            difference: diff,
            condition: item.condition && item.condition !== '—' ? item.condition : 'Good',
            issued_destroyed: item.issued_destroyed && item.issued_destroyed !== '—' ? item.issued_destroyed : '',
            issued_destroyed_qty: (item.issued_destroyed === 'Issued' || item.issued_destroyed === 'Destroyed') ? Number(item.issued_destroyed_qty || 1) : null,
            issued_destroyed_id: item.issued_destroyed_id || null,
            label_no: (item.label_no || '').trim(),
            remarks: (item.remarks || '').trim(),
            status,
            in_inventory: true
          };
        })
      };

      const res = await api.post('/verifications', payload);
      if (res.success) {
        toast.success('Annual verification confirmed and permanently saved.');
        navigate('/verification/history');
      }
    } catch (err) {
      console.error('Failed to confirm verification:', err);
      toast.error(err.message || 'Failed to confirm verification.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (draftInfo) {
      setIsCancelDraftModalOpen(true);
    } else if (hasUnsavedChanges) {
      setIsUnsavedLeaveModalOpen(true);
    } else {
      navigate('/verification');
    }
  };

  const savedItemsCount = Object.keys(savedSnapshots).length;

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Annual Verification', path: '/verification' },
        { label: 'New Verification' }
      ]}
    >
      <div className="print-landscape">
        {/* Printable Report Header */}
        <div className="hidden print:block mb-4">
          <PrintHeader
            reportTitle="Physical Inventory Verification Report"
            subtitle="Annual Board of Survey"
          />
        </div>

      {/* Main Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3.5 no-print">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">New Verification</h1>
        </div>
      </div>

      {/* Draft Continuation Banner */}
      {draftInfo && currentStep === 1 && (
        <div className="mb-3.5 bg-[#1C355E]/5 border border-signal/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle no-print">
          <div className="flex items-center gap-2.5 text-xs text-ink">
            <div className="w-6 h-6 rounded-full bg-signal/15 text-signal flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-ink">Continuing your saved draft</span>
              {draftInfo.updated_at && (
                <span className="text-slate"> (last saved {formatDateTime(draftInfo.updated_at)})</span>
              )}
              <span className="text-slate">. <strong className="text-ink">{savedItemsCount}</strong> of <strong className="text-ink">{items.length}</strong> items saved.</span>
            </div>
          </div>
          <Button
            size="small"
            variant="danger-soft"
            icon={Trash2}
            label="Discard draft"
            onClick={() => setIsDiscardModalOpen(true)}
            disabled={isReadOnly}
            className="self-start sm:self-auto shrink-0"
          />
        </div>
      )}

      {/* Step View Boundary: Automatically resets on step switch and keeps form data intact */}
      <ErrorBoundary
        level="page"
        resetKey={`step-${currentStep}`}
        title="Verification View Interrupted"
        onReset={() => {
          setCurrentStep(1);
          toast.info('Your entries were kept.');
        }}
      >
      {/* ========================================================================= */}
      {/* STEP 1: VERIFICATION ENTRY FORM                                           */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-3.5">
          {/* Top Compact Information Card + Integrated Filter Bar */}
          <div className="bg-card border border-line rounded-xl shadow-card overflow-hidden">
            {/* Top Details Section (2 compact rows) */}
            <div className="p-3.5 sm:p-4 space-y-3">
              {/* Row 1: Location | Date * | Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_100px] gap-3 items-start">
                {/* Location Chip */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-[10px] font-semibold text-slate uppercase tracking-wider mb-1">
                    Location
                  </label>
                  <div
                    className="h-9 bg-[#F1F3F5] text-slate border border-line rounded-lg px-2.5 flex items-center gap-2 cursor-default select-none text-xs font-medium"
                    title={locationDisplay}
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate shrink-0" />
                    <span className="truncate">{locationDisplay}</span>
                  </div>
                </div>

                {/* Date Input */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate uppercase tracking-wider mb-1">
                    Date <span className="text-[#B4483A]">*</span>
                  </label>
                  <DateInput
                    required
                    tabIndex={1}
                    value={date}
                    onChange={handleDateChange}
                    error={errors.date}
                    placeholder="dd/mm/yyyy"
                    disabled={isReadOnly}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Year Input (Read-only, auto-calculated from Date) */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate uppercase tracking-wider mb-1">
                    Year
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={year || ''}
                    title="Cycle year derived automatically from verification date"
                    className="w-full h-9 bg-[#F1F3F5] text-slate border border-line rounded-lg px-3 text-xs font-mono font-medium cursor-default focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Verified By * (3 compact inputs side by side) */}
              <div>
                <label className="block text-[10px] font-semibold text-slate uppercase tracking-wider mb-1">
                  Verified By <span className="text-[#B4483A]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <input
                      type="text"
                      required
                      autoFocus
                      tabIndex={2}
                      placeholder="Verifier 1 name *"
                      value={verifier1}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        setVerifier1(e.target.value);
                        if (errors.verifier1) setErrors(prev => ({ ...prev, verifier1: null }));
                      }}
                      className={`w-full h-9 bg-card border ${
                        errors.verifier1 ? 'border-[#B4483A] ring-1 ring-[#B4483A]/30' : 'border-line hover:border-slate/50'
                      } rounded-lg px-3 text-xs text-ink placeholder-slate/70 focus:outline-none focus:border-signal transition-colors disabled:opacity-60`}
                    />
                    {errors.verifier1 && (
                      <p className="text-[11px] text-[#B4483A] font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.verifier1}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      tabIndex={3}
                      placeholder="Verifier 2 name (optional)"
                      value={verifier2}
                      disabled={isReadOnly}
                      onChange={(e) => setVerifier2(e.target.value)}
                      className="w-full h-9 bg-card border border-line hover:border-slate/50 rounded-lg px-3 text-xs text-ink placeholder-slate/70 focus:outline-none focus:border-signal transition-colors disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      tabIndex={4}
                      placeholder="Verifier 3 name (optional)"
                      value={verifier3}
                      disabled={isReadOnly}
                      onChange={(e) => setVerifier3(e.target.value)}
                      className="w-full h-9 bg-card border border-line hover:border-slate/50 rounded-lg px-3 text-xs text-ink placeholder-slate/70 focus:outline-none focus:border-signal transition-colors disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Integrated Slim Filter Toolbar */}
            <div className="border-t border-line/70 bg-surface/30 px-3.5 sm:px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Category Filter Dropdown */}
                <div className="relative min-w-[160px] sm:w-48">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full h-8.5 text-xs bg-card border border-line rounded-lg py-1 pl-2.5 pr-7 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                  >
                    <option value="">All Categories</option>
                    {distinctCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
                </div>

                {/* Free-text Search Box */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" />
                  <input
                    type="text"
                    placeholder="Search serial no. or item name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8.5 pl-8 pr-7 py-1 text-xs bg-card border border-line rounded-lg focus:outline-none focus:border-signal text-ink placeholder-slate/70 shadow-subtle"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate hover:text-ink p-0.5"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Reset Filters */}
                {(selectedCategoryFilter || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryFilter('');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1 text-xs text-[#B4483A] hover:underline font-medium px-1.5 py-1 transition-colors"
                    title="Reset filters"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}

                {/* Testing Helper (Dev / Super Admin & Local Admin only) */}
                {isDevTestingAllowed && !isReadOnly && (
                  <div className="flex items-center gap-2 border-l border-line/70 pl-2.5 ml-1">
                    <button
                      type="button"
                      onClick={() => setIsTestModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                      title="Fill sample test data in-memory"
                    >
                      <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
                      <span>Fill test data</span>
                    </button>
                    {hasTestData && (
                      <button
                        type="button"
                        onClick={handleClearTestData}
                        className="text-xs text-amber-800/90 hover:text-amber-950 hover:underline px-1 py-1 font-medium cursor-pointer"
                        title="Clear helper-generated test data"
                      >
                        Clear test data
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Items Counter + "Save all" Button */}
              <div className="flex items-center gap-3 text-xs text-slate shrink-0">
                {dirtyRows.length > 0 && !isReadOnly && (
                  <button
                    type="button"
                    onClick={handleSaveAll}
                    disabled={isSavingAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-signal hover:bg-[#1f406b] rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Save all unsaved rows to draft"
                  >
                    {isSavingAll ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save all ({dirtyRows.length})</span>
                  </button>
                )}

                <div>
                  Showing <span className="font-semibold text-ink">{filteredItems.length}</span> items
                  {items.length !== filteredItems.length && (
                    <span className="text-slate/60"> (of {items.length} total)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Inline Validation Banner if row verification criteria is not satisfied */}
          {errors.items && (
            <div className="p-2.5 bg-[#B4483A]/10 border border-[#B4483A]/30 text-[#B4483A] text-xs font-medium rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.items}</span>
            </div>
          )}

          {/* Test Data Active Banner */}
          {hasTestData && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs animate-fade-in no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-amber-950">Test data filled ({testFilledCount} rows).</span>
                  <span className="text-amber-800 ml-1.5">Nothing has been saved or submitted.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleClearTestData}
                  className="px-3 py-1 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                >
                  Clear test data
                </button>
              </div>
            </div>
          )}

          {/* Verification Table with Sticky Header & Contained Scroll */}
          <div className="bg-card border border-line rounded-xl shadow-card overflow-hidden">
            <div
              ref={tableContainerRef}
              className="overflow-x-auto max-h-[calc(100vh-320px)] min-h-[340px] overflow-y-auto"
            >
              <table className="w-full min-w-[1550px] text-left text-xs text-ink border-collapse table-auto">
                <thead className="sticky top-0 z-30 bg-white border-b border-line shadow-xs">
                  <tr className="bg-white font-semibold text-slate uppercase tracking-wider text-[11px]">
                    {/* Column 1: No (Plain table cell) */}
                    <th
                      className="w-12 min-w-[48px] max-w-[48px] text-center border-r border-line/60"
                      style={{ backgroundColor: '#ffffff', width: '48px', minWidth: '48px', maxWidth: '48px', position: 'static', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}
                    >
                      No.
                    </th>
                    {/* Column 2: Serial No (Plain table cell, w-[420px] min-w-[400px]) */}
                    <th
                      className="w-[420px] min-w-[400px] border-r border-line text-left"
                      style={{ backgroundColor: '#ffffff', width: '420px', minWidth: '400px', position: 'static', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}
                    >
                      Serial No.
                    </th>
                    <th className="min-w-[170px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Item</th>
                    <th className="min-w-[130px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Category</th>
                    <th className="text-center min-w-[90px]" title="System Qty" aria-label="System Qty" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>System<br />Qty</th>
                    <th className="text-center min-w-[90px]" title="Physical Qty" aria-label="Physical Qty" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Physical<br />Qty</th>
                    <th className="text-center min-w-[85px]" title="Difference" aria-label="Difference" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Difference</th>
                    <th className="text-center min-w-[105px]" title="Condition" aria-label="Condition" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Condition</th>
                    <th className="text-center min-w-[140px] w-[140px]" title="Issued / Destroyed" aria-label="Issued / Destroyed" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Issued /<br />Destroyed</th>
                    <th className="text-center min-w-[110px]" title="Label No" aria-label="Label No" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Label No</th>
                    <th className="text-left min-w-[140px]" title="Remarks" aria-label="Remarks" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Remarks</th>
                    <th className="text-center min-w-[110px]" title="Actions" aria-label="Actions" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate">
                        <div className="inline-block w-6 h-6 border-2 border-line border-t-ink rounded-full animate-spin mb-2"></div>
                        <div>Loading unit inventory items...</div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate">
                        <div className="text-sm font-medium text-ink">No inventory items found for this unit.</div>
                        <p className="text-xs mt-1 text-slate">Add items from Inventory &gt; Item Categories first.</p>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate">
                        <div className="text-sm font-medium text-ink">No matching items found.</div>
                        <p className="text-xs mt-1 text-slate">Try adjusting your category filter or search query.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((row, idx) => {
                      const itemId = row.inventory_item_id || row.item_id || row.id;
                      const saved = savedSnapshots[itemId];
                      const isSaved = Boolean(saved);
                      const isDirty = isRowDirty(row, saved);
                      const isSaving = Boolean(savingRows[itemId]);

                      return (
                        <VerificationRow
                          key={row.id || `${row.originalIndex}-${row.item_code}`}
                          row={row}
                          idx={idx}
                          searchQuery={searchQuery}
                          selectedCategoryFilter={selectedCategoryFilter}
                          onFieldChange={handleItemFieldChange}
                          onPromptRemove={handlePromptRemoveRow}
                          onSaveRow={handleSaveRow}
                          onIssuedDestroyedSelect={handleIssuedDestroyedSelect}
                          recordedQty={recordedQtyMap[itemId] || 0}
                          isSaving={isSaving}
                          isDirty={isDirty}
                          isSaved={isSaved}
                          isReadOnly={isReadOnly}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Action Bar (Step 1) - Sticky */}
          <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-line py-2.5 px-4 -mx-4 sm:-mx-6 sm:px-6 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.06)] no-print">
            <Button
              size="regular"
              variant="secondary"
              label="Cancel"
              onClick={handleCancel}
            />

            <Button
              size="regular"
              variant="primary"
              label="Submit"
              iconRight={ChevronRight}
              onClick={handleSubmitToReview}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: REVIEW & CONFIRM SCREEN                                           */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-3.5">
          {/* Top Banner (Review & Confirm — read-only) */}
          <div className="bg-card border border-line rounded-xl py-2 px-3.5 shadow-card flex items-center justify-center gap-2 text-xs text-ink no-print">
            <ClipboardCheck className="w-4 h-4 text-signal shrink-0" />
            <span>
              <strong>Review &amp; Confirm</strong> — read-only. Click <strong>Update</strong> to make changes.
            </span>
          </div>

          {/* Compact Summary Card (2 compact rows matching Step 1) */}
          <div className="bg-card border border-line rounded-xl p-3.5 sm:p-4 shadow-card space-y-3">
            {/* Row 1: Location | Date | Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_100px] gap-3 items-center">
              {/* Location */}
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-1">
                  Location
                </div>
                <div
                  className="h-9 bg-[#F1F3F5] text-slate border border-line rounded-lg px-2.5 flex items-center gap-2 text-xs font-semibold select-none"
                  title={locationDisplay}
                >
                  <MapPin className="w-3.5 h-3.5 text-signal shrink-0" />
                  <span className="truncate text-ink">{locationDisplay}</span>
                </div>
              </div>

              {/* Date */}
              <div>
                <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-1">
                  Verification Date
                </div>
                <div className="h-9 bg-card border border-line rounded-lg px-3 flex items-center text-xs font-mono font-bold text-ink">
                  {formatDate(date)}
                </div>
              </div>

              {/* Year */}
              <div>
                <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-1">
                  Audit Year
                </div>
                <div className="h-9 bg-[#F1F3F5] text-slate border border-line rounded-lg px-3 flex items-center text-xs font-mono font-bold">
                  {year}
                </div>
              </div>
            </div>

            {/* Row 2: Verified By */}
            <div>
              <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-1">
                Verified By
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="h-9 bg-card border border-line rounded-lg px-3 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-ink text-white flex items-center justify-center text-[9px] font-bold">
                    1
                  </span>
                  <span className="text-xs font-medium text-ink">{verifier1 || '—'}</span>
                </div>

                {verifier2 && (
                  <div className="h-9 bg-card border border-line rounded-lg px-3 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-ink text-white flex items-center justify-center text-[9px] font-bold">
                      2
                    </span>
                    <span className="text-xs font-medium text-ink">{verifier2}</span>
                  </div>
                )}

                {verifier3 && (
                  <div className="h-9 bg-card border border-line rounded-lg px-3 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-ink text-white flex items-center justify-center text-[9px] font-bold">
                      3
                    </span>
                    <span className="text-xs font-medium text-ink">{verifier3}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Test Data Active Banner in Step 2 */}
          {hasTestData && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-xl flex items-center justify-between text-xs animate-fade-in no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-amber-950">Test data active ({testFilledCount} rows).</span>
                  <span className="text-amber-800 ml-1.5">Reviewing sample test values. Nothing has been saved to the database.</span>
                </div>
              </div>
            </div>
          )}

          {/* Read-Only Table */}
          <div className="bg-card border border-line rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-320px)] min-h-[340px] overflow-y-auto">
              <table className="w-full min-w-[1550px] text-left text-xs text-ink border-collapse table-auto">
                <thead className="sticky top-0 z-30 bg-white border-b border-line shadow-xs">
                  <tr className="border-b border-line bg-white font-semibold text-slate uppercase tracking-wider text-[11px]">
                    <th className="w-12 min-w-[48px] max-w-[48px] text-center border-r border-line/60" style={{ backgroundColor: '#ffffff', width: '48px', minWidth: '48px', maxWidth: '48px', position: 'static', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>No.</th>
                    <th className="w-[420px] min-w-[400px] border-r border-line text-left" style={{ backgroundColor: '#ffffff', width: '420px', minWidth: '400px', position: 'static', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Serial No.</th>
                    <th className="min-w-[170px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Item</th>
                    <th className="min-w-[130px] text-left" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Category</th>
                    <th className="text-center min-w-[90px]" title="System Qty" aria-label="System Qty" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>System<br />Qty</th>
                    <th className="text-center min-w-[90px]" title="Physical Qty" aria-label="Physical Qty" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Physical<br />Qty</th>
                    <th className="text-center min-w-[85px]" title="Difference" aria-label="Difference" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Difference</th>
                    <th className="text-center min-w-[105px]" title="Condition" aria-label="Condition" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Condition</th>
                    <th className="text-center min-w-[140px] w-[140px]" title="Issued / Destroyed" aria-label="Issued / Destroyed" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Issued /<br />Destroyed</th>
                    <th className="text-center min-w-[110px]" title="Label No" aria-label="Label No" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Label No</th>
                    <th className="text-left min-w-[140px]" title="Remarks" aria-label="Remarks" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Remarks</th>
                    <th className="text-center min-w-[100px]" title="Status" aria-label="Status" style={{ backgroundColor: '#ffffff', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.25, verticalAlign: 'bottom', padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {items.map((row, idx) => {
                    const hasPhysQty = row.physical_qty !== '' && row.physical_qty !== null && !isNaN(Number(row.physical_qty));
                    const diff = hasPhysQty ? Number(row.difference) : null;
                    const markedQty = Number(row.issued_destroyed_qty || 1);

                    return (
                      <tr key={row.id || idx} className="hover:bg-surface/50 transition-colors group">
                        {/* 1. No */}
                        <td className="py-2.5 px-3 text-center text-slate font-mono font-medium align-top w-12 min-w-[48px] max-w-[48px] border-r border-line/60" style={{ width: '48px', minWidth: '48px', maxWidth: '48px', position: 'static' }}>
                          {idx + 1}
                        </td>

                        {/* 2. Serial No. */}
                        <td className="py-2.5 px-3 w-[420px] min-w-[400px] align-top border-r border-line" style={{ width: '420px', minWidth: '400px', position: 'static' }}>
                          <SerialNumberCell
                            serialNumbers={row.serial_numbers}
                            manufacturerSerialNumbers={row.manufacturer_serial_numbers}
                            singleSerial={row.item_code}
                            singleMfg={row.manufacturer_sn}
                          />
                        </td>

                        {/* 3. Item */}
                        <td className="py-2.5 px-4 font-semibold text-ink align-top min-w-[170px] leading-snug">
                          {row.item_name}
                        </td>

                        {/* 4. Category */}
                        <td className="py-2.5 px-3 text-slate align-top min-w-[130px] leading-snug">
                          {row.category}
                        </td>

                        {/* 5. System Qty */}
                        <td className="py-2.5 px-3 text-center font-bold text-ink font-mono text-sm align-top whitespace-nowrap min-w-[75px]">
                          {row.system_qty}
                        </td>

                        {/* 6. Physical Qty */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-ink text-sm align-top whitespace-nowrap min-w-[85px]">
                          {row.physical_qty !== '' && row.physical_qty !== null ? row.physical_qty : '—'}
                        </td>

                        {/* 7. Difference */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold align-top whitespace-nowrap min-w-[75px]">
                          {diff === null ? (
                            <span className="text-slate font-normal">—</span>
                          ) : diff === 0 ? (
                            <span className="text-[#2F7A5C]">0</span>
                          ) : (
                            <span className="text-[#B4483A]">{diff > 0 ? `+${diff}` : diff}</span>
                          )}
                        </td>

                        {/* 8. Condition */}
                        <td className="py-2.5 px-3 align-top whitespace-nowrap min-w-[105px]">
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-surface border border-line text-ink">
                            {row.condition || '—'}
                          </span>
                        </td>

                        {/* 9. Issued / Destroyed */}
                        <td className="py-2.5 px-3 whitespace-nowrap align-top min-w-[210px] w-[220px]">
                          {row.issued_destroyed === 'Issued' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/50 text-emerald-700 bg-emerald-50/40">
                              Issued{markedQty > 1 ? ` × ${markedQty}` : ''}
                            </span>
                          ) : row.issued_destroyed === 'Destroyed' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/50 text-rose-700 bg-rose-50/40">
                              Destroyed{markedQty > 1 ? ` × ${markedQty}` : ''}
                            </span>
                          ) : row.issued_destroyed === 'N/A' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-line text-slate">
                              N/A
                            </span>
                          ) : (
                            <span className="text-slate">—</span>
                          )}
                        </td>

                        {/* 10. Label No */}
                        <td className={`py-2.5 px-3 align-top ${row.label_no && row.label_no.trim().length > 24 ? 'text-left min-w-[110px] max-w-[220px] font-sans text-xs text-ink whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] leading-snug line-clamp-3 print:line-clamp-none' : 'text-center min-w-[95px] font-mono text-xs text-ink whitespace-nowrap'}`}>
                          {row.label_no && row.label_no.trim() ? (
                            row.label_no.trim().length > 24 ? (
                              <span title={row.label_no.trim()}>{row.label_no.trim()}</span>
                            ) : (
                              <span className="bg-surface px-1.5 py-0.5 rounded border border-line text-ink font-mono inline-block">
                                {row.label_no.trim()}
                              </span>
                            )
                          ) : (
                            <span className="text-slate">—</span>
                          )}
                        </td>

                        {/* 11. Remarks */}
                        <td className="py-2.5 px-4 text-slate text-xs align-top min-w-[140px] max-w-[320px] leading-snug whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] font-sans line-clamp-3 print:line-clamp-none">
                          {row.remarks && row.remarks.trim() ? (
                            <span title={row.remarks.trim()}>{row.remarks.trim()}</span>
                          ) : (
                            <span className="text-slate">—</span>
                          )}
                        </td>

                        {/* 12. Status */}
                        <td className="py-2.5 px-3 text-center align-top whitespace-nowrap min-w-[100px]">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              row.status === 'Matched'
                                ? 'bg-[#2F7A5C]/10 text-[#2F7A5C] border border-[#2F7A5C]/20'
                                : row.status === 'Shortage'
                                ? 'bg-[#B4483A]/10 text-[#B4483A] border border-[#B4483A]/20'
                                : row.status === 'Excess'
                                ? 'bg-[#2F7A5C]/15 text-[#2F7A5C] border border-[#2F7A5C]/30'
                                : 'bg-surface text-slate border border-line'
                            }`}
                          >
                            {row.status || 'Not Counted'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Action Bar (Step 2) */}
          <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-line py-2.5 px-4 -mx-4 sm:-mx-6 sm:px-6 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.06)] no-print">
            <Button
              size="regular"
              variant="secondary"
              label="Cancel"
              onClick={handleCancel}
            />

            <div className="flex items-center gap-2">
              {/* Print Button */}
              <ExportButton
                format="print"
                label="Print Report"
                onClick={() => window.print()}
                title="Print Landscape Verification Document"
              />

              {/* Update Button (Goes back to Step 1 with draft data intact) */}
              {!isExistingConfirmed && (
                <Button
                  size="regular"
                  variant="secondary"
                  icon={Save}
                  label="Update"
                  onClick={() => setCurrentStep(1)}
                  title="Return to form to edit details"
                />
              )}

              {/* Confirm Button */}
              {!isExistingConfirmed && (
                <Button
                  size="regular"
                  variant="primary"
                  label={submitting ? 'Confirming...' : 'Confirm'}
                  iconRight={ChevronRight}
                  onClick={handleConfirmVerification}
                  disabled={submitting || isReadOnly}
                />
              )}

              {isExistingConfirmed && (
                <Button
                  size="regular"
                  variant="primary"
                  label="Return to History"
                  onClick={() => navigate('/verification/history')}
                />
              )}
            </div>
          </div>
        </div>
      )}
      </ErrorBoundary>

      {/* Bottom Back Button */}
      <div className="no-print">
        <BackButton to="/verification" id="btn-back-verification" />
      </div>

      {/* Confirmation Dialog for Removing Item */}
      <ConfirmModal
        isOpen={!!itemToRemove}
        onClose={() => setItemToRemove(null)}
        onConfirm={handleConfirmRemoveRow}
        title="Remove Item?"
        message="Are you sure you want to remove this item from the verification?"
        itemDetail={
          itemToRemove?.item
            ? `${itemToRemove.item.item_name}${itemToRemove.item.item_code ? ` – ${itemToRemove.item.item_code}` : ''}`
            : null
        }
        confirmLabel="Yes, Remove"
        cancelLabel="Cancel"
        isDestructive={true}
      />

      {/* Confirmation Dialog for Discarding Draft from Banner */}
      <ConfirmModal
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        onConfirm={handleConfirmDiscardDraft}
        title="Discard Saved Draft?"
        message="Are you sure you want to discard this in-progress draft verification? All saved counts and row entries will be cleared and the verification will restart from scratch."
        confirmLabel={isDiscarding ? "Discarding..." : "Yes, Discard Draft"}
        cancelLabel="Keep Draft"
        isDestructive={true}
      />

      {/* Confirmation Dialog on Cancel with Active Draft */}
      {isCancelDraftModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto no-print animate-fade-in"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            cancelDraftBackdropRef.current = (e.target === e.currentTarget);
          }}
          onMouseUp={(e) => {
            if (e.target !== e.currentTarget) {
              cancelDraftBackdropRef.current = false;
            }
          }}
          onClick={(e) => {
            if (cancelDraftBackdropRef.current && e.target === e.currentTarget) {
              setIsCancelDraftModalOpen(false);
            }
            cancelDraftBackdropRef.current = false;
          }}
        >
          <div
            className="bg-card rounded-xl border border-line shadow-modal w-full max-w-md max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] flex flex-col overflow-hidden m-auto shrink-0 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-line bg-surface/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-signal/10 text-signal">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-ink">
                  Leave Verification?
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                icon={X}
                onClick={() => setIsCancelDraftModalOpen(false)}
                aria-label="Close dialog"
              />
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate leading-relaxed">
                You have an active draft with saved line items. Would you like to keep your saved progress to continue later, or discard the draft?
              </p>
            </div>

            <div className="p-4 border-t border-line bg-surface/50 flex flex-wrap items-center justify-end gap-2">
              <Button
                size="regular"
                variant="secondary"
                label="Continue Editing"
                onClick={() => setIsCancelDraftModalOpen(false)}
              />
              <Button
                size="regular"
                variant="danger-solid"
                label="Discard Draft & Exit"
                onClick={async () => {
                  setIsCancelDraftModalOpen(false);
                  try {
                    await api.delete('/verifications/draft', { unit_id: effectiveUnitId });
                  } catch (err) {
                    console.error(err);
                  }
                  navigate('/verification');
                }}
              />
              <Button
                size="regular"
                variant="primary"
                label="Keep Draft & Exit"
                onClick={() => {
                  setIsCancelDraftModalOpen(false);
                  navigate('/verification');
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Dialog on Cancel with Unsaved Changes and No Draft */}
      <ConfirmModal
        isOpen={isUnsavedLeaveModalOpen}
        onClose={() => setIsUnsavedLeaveModalOpen(false)}
        onConfirm={() => {
          setIsUnsavedLeaveModalOpen(false);
          navigate('/verification');
        }}
        title="Unsaved Changes"
        message="You have unsaved rows. If you leave now, any un-saved edits will be lost. Are you sure you want to leave?"
        confirmLabel="Leave Without Saving"
        cancelLabel="Stay on Page"
        isDestructive={true}
      />

      {/* Safety Confirmation Dialog when Submitting Verification Containing Test Data */}
      <ConfirmModal
        isOpen={isTestDataSafetyModalOpen}
        onClose={() => {
          setIsTestDataSafetyModalOpen(false);
          setPendingSubmitAction(null);
        }}
        onConfirm={() => {
          setIsTestDataSafetyModalOpen(false);
          if (pendingSubmitAction) {
            const act = pendingSubmitAction;
            setPendingSubmitAction(null);
            act();
          }
        }}
        title="Test Data Detected"
        message="This verification contains test data (TEST-... labels). Submit anyway?"
        confirmLabel="Submit Anyway"
        cancelLabel="Cancel"
        isDestructive={false}
      />

      {/* Test Data Options Modal */}
      {isTestModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto no-print animate-fade-in"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            testModalBackdropRef.current = (e.target === e.currentTarget);
          }}
          onMouseUp={(e) => {
            if (e.target !== e.currentTarget) {
              testModalBackdropRef.current = false;
            }
          }}
          onClick={(e) => {
            if (testModalBackdropRef.current && e.target === e.currentTarget) {
              setIsTestModalOpen(false);
            }
            testModalBackdropRef.current = false;
          }}
        >
          <div
            className="bg-card rounded-xl border border-line shadow-modal w-full max-w-md max-h-[calc(100vh-32px)] flex flex-col overflow-hidden m-auto shrink-0 animate-scale-up text-ink"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-line bg-surface/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/15 text-amber-700">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Fill Test Data</h2>
                  <p className="text-[11px] text-slate">In-memory verification helper (no database writes)</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                icon={X}
                onClick={() => setIsTestModalOpen(false)}
                aria-label="Close dialog"
              />
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              {/* Scope */}
              <div>
                <label className="block font-semibold text-slate uppercase text-[10px] tracking-wider mb-1.5">
                  Target Rows Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    testScope === 'visible' ? 'border-signal bg-signal/5 text-ink font-semibold' : 'border-line text-slate hover:border-slate/40'
                  }`}>
                    <input
                      type="radio"
                      name="test_scope"
                      value="visible"
                      checked={testScope === 'visible'}
                      onChange={() => setTestScope('visible')}
                      className="text-signal focus:ring-0"
                    />
                    <span>Visible ({filteredItems.length})</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    testScope === 'all' ? 'border-signal bg-signal/5 text-ink font-semibold' : 'border-line text-slate hover:border-slate/40'
                  }`}>
                    <input
                      type="radio"
                      name="test_scope"
                      value="all"
                      checked={testScope === 'all'}
                      onChange={() => setTestScope('all')}
                      className="text-signal focus:ring-0"
                    />
                    <span>All Rows ({items.length})</span>
                  </label>
                </div>
              </div>

              {/* Only Empty Rows Checkbox */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={testOnlyEmpty}
                    onChange={(e) => setTestOnlyEmpty(e.target.checked)}
                    className="w-4 h-4 rounded border-line text-signal focus:ring-0 cursor-pointer"
                  />
                  <span className="font-medium text-ink">Only fill rows that are still empty</span>
                </label>
                <p className="text-[11px] text-slate ml-6 mt-0.5">
                  Preserves any rows where you already entered a count or condition.
                </p>
              </div>

              {/* Fill Pattern */}
              <div>
                <label className="block font-semibold text-slate uppercase text-[10px] tracking-wider mb-1">
                  Fill Pattern
                </label>
                <select
                  value={testPattern}
                  onChange={(e) => setTestPattern(e.target.value)}
                  className="w-full text-xs bg-surface border border-line rounded-lg px-2.5 py-1.5 text-ink font-medium focus:outline-none focus:border-signal cursor-pointer"
                >
                  <option value="realistic">Realistic mix (~80% matched, ~12% shortage, ~8% excess)</option>
                  <option value="all_matched">All matched (100% matched system qty, 0 diff)</option>
                  <option value="shortages_excess">Random shortages &amp; excess (50/50 mix)</option>
                </select>
              </div>

              {/* Percentage to Fill */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate uppercase text-[10px] tracking-wider">
                    Rows to Fill: {testPercentage}%
                  </label>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={testPercentage}
                  onChange={(e) => setTestPercentage(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate/70">
                  <span>10%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Fill Header Fields Checkbox */}
              <div className="pt-2 border-t border-line/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={testFillHeaders}
                    onChange={(e) => setTestFillHeaders(e.target.checked)}
                    className="w-4 h-4 rounded border-line text-signal focus:ring-0 cursor-pointer"
                  />
                  <span className="font-medium text-ink">Also fill header fields</span>
                </label>
                <p className="text-[11px] text-slate ml-6 mt-0.5">
                  Fills Verifier 1-3 with "Test Verifier 1/2/3" and keeps the verification date.
                </p>
              </div>
            </div>

            <div className="p-3.5 border-t border-line bg-surface/50 flex items-center justify-end gap-2">
              <Button
                size="small"
                variant="secondary"
                label="Cancel"
                onClick={() => setIsTestModalOpen(false)}
              />
              <Button
                size="small"
                variant="primary"
                label="Fill Test Data"
                onClick={handleFillTestData}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </AppShell>
  );
};

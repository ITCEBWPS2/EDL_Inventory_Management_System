import React from 'react';
import {
  Send,
  UserCheck,
  ClipboardCheck,
  Flame,
  Truck,
  Printer,
  RotateCcw,
  Edit2,
  CheckCircle2
} from 'lucide-react';
import { StepActionButton } from './StepActionButton';

/**
 * StepActionBar: Shared unified step action bar across all Disposal steps
 *
 * Enforces strict button ordering:
 * [primary step action(s)] [Print Report] [Revert Last Step]
 * Aligned to the right, single row, wrapping neatly.
 */
export const StepActionBar = ({
  request,
  user,
  destructionCount = 0,
  tenderCount = 0,
  onSubmitDraft,
  onRecordBoard,
  onRecordCommittee,
  onRecordDestruction,
  onRecordTender,
  onPrintReport,
  onRevert,
  canSubmit = false,
  canHandle = false,
  canPrint = false,
  canEdit = false,
  onEditDraft,
  isSuperAdmin = false,
  className = ''
}) => {
  if (!request) return null;

  const status = request.status;
  const isDraft = status === 'draft';
  const isSubmitted = status === 'submitted';
  const isBoardAppointed = status === 'board_appointed';
  const isApproved = status === 'approved';
  const isInDisposal = status === 'in_disposal';
  const isCompleted = status === 'completed';
  const isRejected = status === 'rejected';

  // Helper text for roles without permission
  let waitingHelper = null;
  if (!isCompleted && !isRejected) {
    if (isDraft && !canSubmit) {
      waitingHelper = 'Waiting for creator to record this step';
    } else if (isSubmitted && !canHandle) {
      waitingHelper = 'Waiting for management to record this step';
    } else if (isBoardAppointed && !canHandle) {
      waitingHelper = 'Waiting for committee to record this step';
    } else if ((isApproved || isInDisposal) && !canHandle) {
      waitingHelper = 'Waiting for disposal team to record this step';
    }
  }

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2.5 ${className}`} data-testid="step-action-bar">
      {/* 1. Optional waiting helper for unauthorized roles */}
      {waitingHelper && (
        <span className="text-xs text-[#6B5A66] italic bg-[#F7E9EE]/60 px-3 py-1.5 rounded-lg border border-[#7B1C3E]/15 select-none">
          {waitingHelper}
        </span>
      )}

      {/* 2. Step 1: Draft actions */}
      {isDraft && canEdit && onEditDraft && (
        <StepActionButton
          variant="secondary"
          icon={Edit2}
          label="Edit Draft"
          onClick={onEditDraft}
          id="btn-edit-draft"
        />
      )}
      {isDraft && canSubmit && (
        <StepActionButton
          variant="primary"
          icon={Send}
          label="Submit for Board Appointment"
          onClick={onSubmitDraft}
          id="btn-submit-draft"
        />
      )}

      {/* 3. Step 2: Submitted -> Record Board Appointment */}
      {isSubmitted && canHandle && (
        <StepActionButton
          variant="primary"
          icon={UserCheck}
          label="Record Board Appointment"
          onClick={onRecordBoard}
          id="btn-record-board"
        />
      )}

      {/* 4. Step 3: Board Appointed -> Record Committee Decision */}
      {isBoardAppointed && canHandle && (
        <StepActionButton
          variant="primary"
          icon={ClipboardCheck}
          label="Record Committee Decision"
          onClick={onRecordCommittee}
          id="btn-record-committee"
        />
      )}

      {/* 5. Step 4: Approved / In Disposal -> Record Destruction and/or Record Tender Release */}
      {(isApproved || isInDisposal) && canHandle && (
        <>
          {destructionCount > 0 && (
            <StepActionButton
              variant="primary"
              icon={Flame}
              label="Record Destruction"
              count={destructionCount}
              onClick={onRecordDestruction}
              id="btn-record-destruction"
            />
          )}
          {tenderCount > 0 && (
            <StepActionButton
              variant="primary"
              icon={Truck}
              label="Record Tender Release"
              count={tenderCount}
              onClick={onRecordTender}
              id="btn-record-tender"
            />
          )}
        </>
      )}

      {/* 6. Step 5: Completed status placeholder */}
      {isCompleted && (
        <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#F7E9EE] border border-[#7B1C3E]/30 text-xs font-bold text-[#7B1C3E] select-none">
          <CheckCircle2 className="w-4 h-4 text-[#7B1C3E]" />
          <span>Completed</span>
        </div>
      )}

      {/* 7. Secondary Action: Print Report (Order: always after primary step action) */}
      {!isDraft && canPrint && onPrintReport && (
        <StepActionButton
          variant="secondary"
          icon={Printer}
          label="Print Report"
          onClick={onPrintReport}
          title="Print Board of Survey Report"
          id="btn-print-report"
        />
      )}

      {/* 8. Super Admin Revert: Small outlined red button (Order: always last in row) */}
      {!isDraft && isSuperAdmin && onRevert && (
        <StepActionButton
          variant="danger-outline"
          icon={RotateCcw}
          label="Revert Last Step"
          onClick={onRevert}
          title="Revert last workflow step (Super Admin only)"
          id="btn-revert-step"
        />
      )}
    </div>
  );
};

export default StepActionBar;

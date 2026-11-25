import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ArrowRight, Plus, AlertCircle, RotateCcw } from 'lucide-react';
import { formatDate, formatRelativeDays, getVerificationCycleStatus } from '../../utils/formatters';

export const LastVerificationCard = ({
  lastVerification = null,
  selectedUnitId = '',
  canWrite = false,
  loading = false,
  error = false,
  onRetry = null,
  className = ''
}) => {
  return (
    <div className={`glass-card p-4 sm:p-[18px] flex flex-col justify-between ${className}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <ClipboardCheck className="w-4 h-4 text-[#f6c026] shrink-0" />
        <h3 className="text-[15px] font-semibold text-[#280818]">Last Verification</h3>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2 py-1">
          <div className="flex items-center justify-between">
            <div className="h-6 bg-[#fcfbf9] rounded w-28"></div>
            <div className="h-5 bg-[#fcfbf9] rounded w-16"></div>
          </div>
          <div className="h-3 bg-[#fcfbf9] rounded w-20"></div>
          <div className="h-3 bg-[#fcfbf9] rounded w-40"></div>
        </div>
      ) : error ? (
        <div className="py-2.5 flex flex-col gap-1 text-xs text-[#8a7a80]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#b33947] shrink-0" />
            <span>Unable to load verification data</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-[#7a1a3c] hover:underline text-xs font-medium w-fit mt-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      ) : lastVerification ? (
        (() => {
          const lv = lastVerification;
          const cycleStatus = getVerificationCycleStatus(lv.date);
          const relativeText = formatRelativeDays(lv.date);
          const fullVerifiers = (lv.verified_by || []).join(', ');

          return (
            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xl font-bold text-[#280818] tabular-nums tracking-tight">
                    {formatDate(lv.date)}
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${cycleStatus.colorClass}`}
                  >
                    {cycleStatus.label}
                  </span>
                </div>

                {relativeText && (
                  <p className="text-xs text-[#4A4D5A] mt-0.5 font-medium">
                    {relativeText}
                  </p>
                )}
              </div>

              {/* Verifier Names truncated to one line with tooltip */}
              <div className="space-y-0.5 text-xs text-[#4A4D5A]">
                {fullVerifiers && (
                  <p className="truncate" title={fullVerifiers}>
                    Verified by <span className="text-[#280818] font-medium">{fullVerifiers}</span>
                  </p>
                )}
                {!selectedUnitId && lv.unit_name && (
                  <p className="truncate text-[#4A4D5A]/90 text-[11px]">
                    Unit: <span className="font-medium text-[#280818]">{lv.unit_name}</span>
                  </p>
                )}
              </div>

              <div className="pt-2.5 border-t border-[rgba(27,27,36,0.09)]">
                <Link
                  to="/verification/history"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7a1a3c] hover:text-[#5a1230] transition-colors group"
                >
                  <span>Verification Audit Trail</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })()
      ) : (
        /* Empty State */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#4A4D5A]">No verification recorded yet</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded shrink-0 bg-[#fcfbf9] border border-[#eee6e1] text-[#4A4D5A]">
              Not started
            </span>
          </div>

          <div className="pt-2.5 border-t border-[rgba(27,27,36,0.09)] flex items-center justify-between gap-2">
            <Link
              to="/verification/history"
              className="text-xs font-semibold text-[#7a1a3c] hover:text-[#5a1230] transition-colors"
            >
              Verification History
            </Link>
            {canWrite && (
              <Link
                to="/verification/new"
                className="inline-flex items-center gap-1 text-xs font-semibold text-white px-2.5 py-1 rounded-md transition-colors shadow-2xs"
                style={{ backgroundColor: '#7a1a3c' }}
              >
                <Plus className="w-3 h-3" />
                <span>Start Verification</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LastVerificationCard;

import React from 'react';
import { Check, AlertCircle } from 'lucide-react';

export const STEPPER_STAGES = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'board_appointed', label: 'Board Appointed' },
  { key: 'committee_decision', label: 'Committee Decision' },
  { key: 'in_disposal', label: 'Disposal' },
  { key: 'completed', label: 'Completed' }
];

/**
 * DisposalStepper: Standard 5-step stepper using official EDL logo palette
 *
 * Rules:
 * - Completed step: maroon-tint (#F7E9EE), 1.5px maroon border (#7B1C3E), maroon check icon, dark text
 * - Current step: gold border (2px #F4B731), gold-tint (#FFF4D6), gold dot, bold text
 * - Upcoming step: white background, light grey border, grey text
 * - Connector line: maroon between completed steps, light grey after
 */
export const DisposalStepper = ({ status = 'draft', unitName = '', className = '' }) => {
  const getStepStatus = (stepKey) => {
    const s = (status || '').toLowerCase();
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

  return (
    <div id="disposal-stepper" className={`bg-white border border-[#E6DCD7] rounded-xl p-3 sm:p-4 shadow-xs ${className}`}>
      <div className="flex items-center overflow-x-auto py-1 scrollbar-none">
        {STEPPER_STAGES.map((st, idx) => {
          const statusState = getStepStatus(st.key);
          const isCompleted = statusState === 'completed';
          const isCurrent = statusState === 'current';
          const isRejected = statusState === 'rejected';
          const isUpcoming = statusState === 'upcoming';
          const isLast = idx === STEPPER_STAGES.length - 1;

          // Connector line after this step
          // Maroon if this step is completed AND next step is completed or current; otherwise light grey
          const nextState = !isLast ? getStepStatus(STEPPER_STAGES[idx + 1].key) : null;
          const connectorIsMaroon = isCompleted && (nextState === 'completed' || nextState === 'current');

          return (
            <React.Fragment key={st.key}>
              {/* Step Card / Pill */}
              <div
                className={`flex-1 min-w-[130px] sm:min-w-[150px] p-2.5 sm:p-3 rounded-xl border text-center transition-all select-none ${
                  isCurrent
                    ? 'border-2 border-[#F4B731] bg-[#FFF4D6] text-[#280818] shadow-xs'
                    : isCompleted
                    ? 'border-[1.5px] border-[#7B1C3E] bg-[#F7E9EE] text-[#280818] shadow-2xs'
                    : isRejected
                    ? 'border-[1.5px] border-[#B3261E] bg-[#FDF1F1] text-[#B3261E]'
                    : 'border-[#DDD8D5] bg-white text-[#6B5A66]'
                }`}
              >
                {/* Step Number & Indicator */}
                <div className="flex items-center justify-center gap-1.5 mb-1 font-mono text-[10px] font-bold">
                  <span>Step {idx + 1}</span>
                  {isCompleted && (
                    <span className="w-3.5 h-3.5 rounded-full bg-[#7B1C3E] text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                  {isCurrent && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F4B731] ring-2 ring-[#7B1C3E] inline-block animate-pulse" />
                  )}
                  {isRejected && (
                    <AlertCircle className="w-3.5 h-3.5 text-[#B3261E]" />
                  )}
                </div>

                {/* Step Label */}
                <div
                  className={`text-xs truncate ${isCurrent ? 'font-black text-[#280818]' : isCompleted ? 'font-bold text-[#280818]' : 'font-medium'}`}
                  title={st.label}
                >
                  {st.label}
                </div>

                {isRejected && (
                  <div className="text-[10px] font-bold text-[#B3261E] mt-0.5">Rejected</div>
                )}
              </div>

              {/* Connector line between steps */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={`w-3 sm:w-6 h-[2px] mx-1 shrink-0 rounded transition-colors ${
                    connectorIsMaroon ? 'bg-[#7B1C3E]' : 'bg-[#DDD8D5]'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default DisposalStepper;

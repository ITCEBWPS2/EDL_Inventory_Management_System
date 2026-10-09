import React from 'react';
import { Check } from 'lucide-react';

export const StepProgress = ({ currentStep = 1, steps = ['Scope & Year', 'Named Verifiers', 'Count & Reconcile'] }) => {
  return (
    <div className="bg-card rounded-xl border border-line p-4 shadow-subtle mb-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((stepName, idx) => {
          const stepNumber = idx + 1;
          const isDone = currentStep > stepNumber;
          const isCurrent = currentStep === stepNumber;

          return (
            <React.Fragment key={stepNumber}>
              {/* Step Node */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums transition-colors shadow-subtle ${
                    isDone
                      ? 'bg-[#2F7A5C] text-white'
                      : isCurrent
                      ? 'bg-ink text-signal ring-2 ring-signal ring-offset-2'
                      : 'bg-surface border border-line text-slate'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : stepNumber}
                </div>
                <div className="hidden sm:block">
                  <div className="text-[10px] uppercase tracking-wider text-slate font-medium">
                    Step {stepNumber}
                  </div>
                  <div className={`text-xs font-semibold ${isCurrent ? 'text-ink' : 'text-slate'}`}>
                    {stepName}
                  </div>
                </div>
              </div>

              {/* Connecting Divider */}
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 sm:mx-6 transition-colors ${
                    currentStep > stepNumber ? 'bg-[#2F7A5C]' : 'bg-line'
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

import React from 'react';
import { Check, X } from 'lucide-react';
import { checkPasswordRules, getPasswordStrength } from '../../utils/authValidation';

export const PasswordRulesAndMeter = ({ password }) => {
  const rules = checkPasswordRules(password);
  const strength = getPasswordStrength(password);
  const hasValue = Boolean(password);

  return (
    <div className="w-full mt-2 space-y-2 text-left animate-in fade-in duration-200">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span style={{ color: '#6b5a66' }}>Password Strength:</span>
          {hasValue ? (
            <span
              className="font-bold uppercase tracking-wider text-[10.5px]"
              style={{ color: strength.color }}
            >
              {strength.label}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">Not entered</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full bg-[rgba(122,28,61,0.08)] rounded-full overflow-hidden p-0.5">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              backgroundColor: strength.score >= 1 ? strength.color : 'transparent'
            }}
          />
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              backgroundColor: strength.score >= 2 ? strength.color : 'transparent'
            }}
          />
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              backgroundColor: strength.score >= 3 ? strength.color : 'transparent'
            }}
          />
        </div>
      </div>

      {/* Rules Checklist */}
      <div className="bg-[rgba(255,255,255,0.70)] border border-[rgba(122,28,61,0.12)] rounded-lg p-2.5 space-y-1.5 shadow-2xs">
        <div className="text-[11px] font-semibold text-[#5a1230] uppercase tracking-wider">
          Password Requirements:
        </div>
        <ul className="space-y-1 text-xs">
          <li className="flex items-center gap-2">
            {rules.minLength ? (
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 border border-slate-300 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              </span>
            )}
            <span
              className={`transition-colors text-[11.5px] ${
                rules.minLength ? 'text-emerald-800 font-medium' : 'text-[#6b5a66]'
              }`}
            >
              Minimum 8 characters
            </span>
          </li>

          <li className="flex items-center gap-2">
            {rules.hasLetter ? (
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 border border-slate-300 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              </span>
            )}
            <span
              className={`transition-colors text-[11.5px] ${
                rules.hasLetter ? 'text-emerald-800 font-medium' : 'text-[#6b5a66]'
              }`}
            >
              At least 1 letter (a-z or A-Z)
            </span>
          </li>

          <li className="flex items-center gap-2">
            {rules.hasNumber ? (
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 border border-slate-300 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              </span>
            )}
            <span
              className={`transition-colors text-[11.5px] ${
                rules.hasNumber ? 'text-emerald-800 font-medium' : 'text-[#6b5a66]'
              }`}
            >
              At least 1 number (0-9)
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PasswordRulesAndMeter;


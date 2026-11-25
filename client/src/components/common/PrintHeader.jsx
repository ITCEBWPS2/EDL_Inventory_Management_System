import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/formatters';
import { getUnitParentChain } from '../../utils/reportUtils';
import { REPORT_REGION_NAME, REPORT_LOGO_PATH, REPORT_COMPANY_NAME } from '../../constants/report';

export { getUnitParentChain };

export const PrintHeader = ({
  reportTitle,
  subtitle = null,
  filtersSummary = null,
  unitOverride = null,
  extraInfo = null,
  className = '',
  showParentChain = false
}) => {
  const { selectedUnitId, selectedUnit, systemUnits } = useAuth();
  const [logoError, setLogoError] = useState(false);

  // Verification audit and transaction history reports omit parent hierarchy chain under Location
  const isExcludedReport = Boolean(
    reportTitle && (
      reportTitle.toLowerCase().includes('verification audit') ||
      reportTitle.toLowerCase().includes('transaction history') ||
      reportTitle.toLowerCase().includes('inventory report')
    )
  );
  const shouldShowParentChain = Boolean(showParentChain && !isExcludedReport);

  // Determine Location and Parent Chain
  const isGlobalUnit = !selectedUnitId || selectedUnitId === 'all';
  let locationDisplay = 'All Units';
  let parentChainDisplay = '';

  if (unitOverride) {
    locationDisplay = unitOverride;
  } else if (!isGlobalUnit && selectedUnit) {
    locationDisplay = selectedUnit.unit_name || selectedUnit.unit_code || 'All Units';
    if (shouldShowParentChain) {
      parentChainDisplay = getUnitParentChain(selectedUnitId, systemUnits);
    }
  } else {
    locationDisplay = 'All Units';
  }

  // Current print timestamp
  const printedOn = formatDateTime(new Date());

  return (
    <header className={`print-report-header mb-4 text-black ${className}`}>
      {/* Top Banner Band: Logo on left (28-30mm in print), Western Province South II in bold serif on right */}
      <div className="print-header-band flex items-center justify-between py-1.5 sm:py-2">
        {/* Left: EDL Logo */}
        <div className="flex items-center">
          {!logoError ? (
            <img
              src={REPORT_LOGO_PATH}
              alt={REPORT_COMPANY_NAME}
              className="print-header-logo h-[28mm] max-h-[30mm] w-auto object-contain print-color-exact"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="flex flex-col text-left">
              <span className="text-3xl font-black tracking-tight text-[#781834] uppercase font-sans">
                EDL
              </span>
              <span className="text-xs font-semibold text-gray-700 tracking-tight leading-none mt-1">
                {REPORT_COMPANY_NAME}
              </span>
            </div>
          )}
        </div>

        {/* Right: Western Province South II in bold serif */}
        <div className="text-right">
          <h1
            className="print-header-region text-[22pt] sm:text-[24pt] font-bold text-black tracking-tight leading-tight"
            style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
          >
            {REPORT_REGION_NAME}
          </h1>
        </div>
      </div>

      {/* Thin solid dark line (about 1 pt) */}
      <div className="w-full border-b border-black"></div>

      {/* Compact Information Block (Two columns: Report & Location on Left, Printed on on Right) */}
      <div className="pt-2 pb-1.5 text-[11px] leading-snug">
        <div className="flex justify-between items-start gap-4">
          {/* Left Column: Report Name & Location */}
          <div className="space-y-0.5">
            <div>
              <span className="font-semibold text-black">Report: </span>
              <span className="font-bold text-black">{reportTitle}</span>
            </div>
            <div>
              <span className="font-semibold text-black">Location: </span>
              <span className="font-bold text-black">{locationDisplay}</span>
              {shouldShowParentChain && parentChainDisplay && parentChainDisplay !== locationDisplay && (
                <div className="text-[10px] text-gray-500 font-normal">
                  {parentChainDisplay}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Printed on */}
          <div className="text-right">
            <div>
              <span className="font-semibold text-black">Printed on: </span>
              <span className="font-mono text-black">{printedOn}</span>
            </div>
          </div>
        </div>

        {/* Filters Summary Line (if any filter is applied) */}
        {filtersSummary && (
          <div className="mt-1 pt-1 border-t border-gray-300 text-[10px] text-gray-700">
            <span className="font-semibold text-black">Filters: </span>
            <span>{filtersSummary}</span>
          </div>
        )}

        {/* Extra Information (e.g. Board of Survey verifier signatures) */}
        {extraInfo && (
          <div className="mt-1 pt-1 border-t border-gray-300 text-[10px] text-gray-800">
            {extraInfo}
          </div>
        )}
      </div>

      {/* Centered Report Title */}
      <div className="text-center pt-2 pb-2">
        <h2 className="text-sm sm:text-base font-bold text-black uppercase tracking-wider inline-block border-b-2 border-black/40 pb-0.5">
          {reportTitle}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-gray-600 mt-0.5 font-normal italic">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
};

export default PrintHeader;

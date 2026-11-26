import React from 'react';
import { PrintHeader } from '../common/PrintHeader';

/**
 * PrintableVerificationTeamsReport
 * A4 Landscape print sheet listing appointed verification teams grouped by hierarchy node.
 * Strictly lists only locations that have an appointed team.
 */
export const PrintableVerificationTeamsReport = ({
  year = new Date().getFullYear(),
  groupedData = {}
}) => {
  // Sort group names
  const groupNames = Object.keys(groupedData).sort((a, b) => {
    if (a.includes('direct')) return -1;
    if (b.includes('direct')) return 1;
    return a.localeCompare(b);
  });

  let seqNo = 1;

  return (
    <div className="printable-count-sheet print-area p-8 bg-white text-ink text-xs font-sans">
      <PrintHeader
        title="ANNUAL PHYSICAL VERIFICATION — TEAMS APPOINTMENT SCHEDULE"
        subtitle={`Official Board of Survey Verifiers Appointment Schedule for Year ${year}`}
        locationDisplay="Western Province South II"
      />

      <div className="mb-4 flex items-center justify-between text-xs text-slate border-b border-line pb-2">
        <div>
          <span className="font-semibold text-ink">Schedule Year: </span>
          <span className="font-mono text-maroon font-bold">{year}</span>
        </div>
        <div>
          <span>Generated: </span>
          <span className="font-mono">{new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </div>

      <table className="w-full border-collapse border border-line text-xs">
        <thead>
          <tr className="bg-surface text-ink font-bold text-[11px] uppercase tracking-wider">
            <th className="border border-line py-2 px-2 text-center w-10">No.</th>
            <th className="border border-line py-2 px-3 text-left w-56">Location / Unit</th>
            <th className="border border-line py-2 px-3 text-left">Verifier 1</th>
            <th className="border border-line py-2 px-3 text-left">Verifier 2</th>
            <th className="border border-line py-2 px-3 text-left">Verifier 3</th>
          </tr>
        </thead>
        <tbody>
          {groupNames.map(groupName => {
            const locs = (groupedData[groupName] || []).filter(
              l => l.team && Array.isArray(l.team.members) && l.team.members.length === 3
            );
            if (locs.length === 0) return null;

            return (
              <React.Fragment key={groupName}>
                {/* Hierarchy Group Header Row */}
                <tr className="bg-maroon-tint/40 text-maroon font-bold">
                  <td colSpan={5} className="border border-line py-1.5 px-3 text-xs tracking-wide">
                    HIERARCHY GROUP: {groupName.toUpperCase()} ({locs.length} appointed)
                  </td>
                </tr>

                {locs.map(loc => {
                  const m1 = loc.team.members[0] || { name: '—', designation: '—' };
                  const m2 = loc.team.members[1] || { name: '—', designation: '—' };
                  const m3 = loc.team.members[2] || { name: '—', designation: '—' };

                  return (
                    <tr key={loc.id} className="border-b border-line/60 hover:bg-surface/30">
                      <td className="border border-line py-2 px-2 text-center font-mono text-slate">
                        {seqNo++}
                      </td>
                      <td className="border border-line py-2 px-3">
                        <div className="font-semibold text-ink">{loc.unit_name || loc.name}</div>
                        <div className="text-[10px] text-slate font-mono">{loc.pathString || loc.unit_code}</div>
                      </td>
                      <td className="border border-line py-2 px-3">
                        <div className="font-semibold text-ink">{m1.name}</div>
                        <div className="text-[10px] text-slate">{m1.designation}</div>
                      </td>
                      <td className="border border-line py-2 px-3">
                        <div className="font-semibold text-ink">{m2.name}</div>
                        <div className="text-[10px] text-slate">{m2.designation}</div>
                      </td>
                      <td className="border border-line py-2 px-3">
                        <div className="font-semibold text-ink">{m3.name}</div>
                        <div className="text-[10px] text-slate">{m3.designation}</div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}

          {seqNo === 1 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-slate italic border border-line">
                No verification teams have been appointed yet for year {year}.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Certification Signature Block */}
      <div className="mt-8 pt-6 border-t border-line/80 flex items-end justify-between text-xs text-slate">
        <div>
          <p className="font-medium text-ink mb-1">Schedule Prepared By:</p>
          <div className="w-48 border-b border-slate/40 mb-1 h-6"></div>
          <p className="text-[10.5px]">Verification Coordinator / Commercial Branch</p>
        </div>

        <div>
          <p className="font-medium text-ink mb-1">Approved &amp; Certified By:</p>
          <div className="w-56 border-b border-slate/40 mb-1 h-6"></div>
          <p className="text-[10.5px] font-semibold text-maroon">Chief Engineer (Commercial) / Regional DGM</p>
          <p className="text-[10px]">Western Province South II</p>
        </div>
      </div>
    </div>
  );
};

export default PrintableVerificationTeamsReport;

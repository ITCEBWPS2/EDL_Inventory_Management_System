import React from 'react';
import { PrintHeader } from '../common/PrintHeader';
import { formatDate } from '../../utils/formatters';

export const BoardOfSurveyPrint = ({ request }) => {
  if (!request) return null;

  const boardMembers = request.board?.members || [];
  const committee = request.committee_decision || {};
  const items = request.items || [];

  return (
    <div className="print-report-container p-6 bg-white text-black font-sans text-xs leading-normal">
      <PrintHeader
        reportTitle="Physical Inventory Verification & Disposal Report"
        subtitle="Annual Board of Survey — Electricity Distribution Lanka"
        unitOverride={request.unit_name || request.unit_id}
      />

      {/* Meta Details Box */}
      <div className="border border-black p-3 my-4 space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p><strong>Disposal Request No:</strong> {request.request_no}</p>
            <p><strong>Unit:</strong> {request.unit_name || request.unit_id}</p>
            <p><strong>Request Title:</strong> {request.title}</p>
          </div>
          <div>
            <p><strong>Status:</strong> {request.status?.toUpperCase()?.replace(/_/g, ' ')}</p>
            <p><strong>Date Initiated:</strong> {formatDate(request.created_at)}</p>
            {request.submitted_at && <p><strong>Date Submitted:</strong> {formatDate(request.submitted_at)}</p>}
          </div>
        </div>

        {/* Board Appointment Section */}
        <div className="border-t border-gray-400 pt-2 mt-2">
          <p className="font-bold uppercase tracking-wider text-[11px] mb-1">
            Board of Survey Appointment Authority — Committee for: {request.unit_name || request.unit_id}
          </p>
          <div className="grid grid-cols-2 gap-4">
            {request.board?.appointment_letter_no && (
              <p><strong>Appointment Letter No:</strong> {request.board.appointment_letter_no}</p>
            )}
            <p><strong>Appointment Date:</strong> {formatDate(request.board?.appointment_date)}</p>
            {request.board?.appointed_by_name && (
              <p><strong>Appointed By (DGM):</strong> {request.board?.appointed_by_name}</p>
            )}
            <p><strong>Appointed Members ({boardMembers.length}):</strong> {boardMembers.map(m => m.name + (m.designation ? ` (${m.designation})` : '')).join(', ') || '—'}</p>
          </div>
        </div>

        {/* Committee Decision Meta */}
        {committee.report_ref && (
          <div className="border-t border-gray-400 pt-2 mt-2">
            <p className="font-bold uppercase tracking-wider text-[11px] mb-1">
              Committee Decision Authority — Committee for: {request.unit_name || request.unit_id}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <p><strong>Committee Report Ref:</strong> {committee.report_ref}</p>
              <p><strong>Decision Date:</strong> {formatDate(committee.decision_date)}</p>
              {committee.inspection_date && <p><strong>Inspection Date:</strong> {formatDate(committee.inspection_date)}</p>}
              <p><strong>Members Present:</strong> {committee.members_present?.join(', ') || '—'}</p>
            </div>
            {committee.remarks && <p className="mt-1"><strong>Committee Remarks:</strong> {committee.remarks}</p>}
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <div className="my-4">
        <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">
          Surveyed Assets &amp; Committee Decisions
        </h3>
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-1 text-center w-8">#</th>
              <th className="border border-black px-2 py-1 text-left">Item Description</th>
              <th className="border border-black px-2 py-1 text-center w-12">Qty</th>
              <th className="border border-black px-2 py-1 text-left">Serial Number(s)</th>
              <th className="border border-black px-2 py-1 text-left">Condition / Reason</th>
              <th className="border border-black px-2 py-1 text-left w-36 font-bold">Committee Decision</th>
              <th className="border border-black px-2 py-1 text-left">Committee Remarks</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const serials = Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
                ? item.serial_numbers.join(', ')
                : (item.serial_number || item.item_code || '—');

              return (
                <tr key={item.id || idx}>
                  <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                  <td className="border border-black px-2 py-1 font-medium">{item.item_name}</td>
                  <td className="border border-black px-2 py-1 text-center">{item.quantity}</td>
                  <td className="border border-black px-2 py-1 font-mono text-[10px]">{serials}</td>
                  <td className="border border-black px-2 py-1">{item.condition_notes || '—'}</td>
                  <td className="border border-black px-2 py-1 font-semibold">{item.committee_decision_item || 'Pending Decision'}</td>
                  <td className="border border-black px-2 py-1">{item.committee_remarks || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Board of Survey Committee Signatures */}
      <div className="mt-8 pt-4 border-t-2 border-black page-break-inside-avoid">
        <p className="font-bold text-xs uppercase tracking-wider mb-4">
          Certification by the Board of Survey Committee
        </p>
        <p className="text-[11px] mb-6 italic">
          We, the undersigned members appointed to the Board of Survey, certify that we have physically inspected the assets listed above, verified their conditions, and made the recorded disposal decisions in accordance with EDL regulations.
        </p>

        <div className="grid grid-cols-3 gap-6">
          {boardMembers.map((member, idx) => (
            <div key={idx} className="border-t border-black pt-2 text-center text-[11px]">
              <p className="font-bold">{member.name}</p>
              <p className="text-gray-700">{member.designation || 'Committee Member'}</p>
              <p className="mt-6 text-[10px] text-gray-500">Date: ________________________</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


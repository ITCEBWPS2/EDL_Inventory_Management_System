import React from 'react';
import { PrintHeader } from '../common/PrintHeader';
import { formatDate } from '../../utils/formatters';

export const DestructionCertificatePrint = ({ request, record }) => {
  if (!request || !record) return null;

  const destroyedItems = request.items?.filter(i => record.item_ids?.includes(String(i.id))) || [];
  const witnesses = record.witnesses || [];

  return (
    <div className="print-report-container p-6 bg-white text-black font-sans text-xs leading-normal">
      <PrintHeader
        reportTitle="Certificate of Asset Destruction"
        subtitle="Board of Survey Disposal Execution — Electricity Distribution Lanka"
        unitOverride={request.unit_name || request.unit_id}
      />

      <div className="border border-black p-3 my-4 space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p><strong>Destruction Certificate Ref:</strong> {record.reference}</p>
            <p><strong>Disposal Request No:</strong> {request.request_no}</p>
            <p><strong>Unit:</strong> {request.unit_name || request.unit_id}</p>
          </div>
          <div>
            <p><strong>Date of Destruction:</strong> {formatDate(record.date)}</p>
            <p><strong>Authority (Committee Report Ref):</strong> {request.committee_decision?.report_ref || 'Board of Survey'}</p>
            <p><strong>Decision Date:</strong> {formatDate(request.committee_decision?.decision_date)}</p>
          </div>
        </div>
        {record.remarks && <p><strong>Destruction Method &amp; Remarks:</strong> {record.remarks}</p>}
      </div>

      <div className="my-4">
        <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">
          Assets Destroyed Under Supervision
        </h3>
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-1 text-center w-8">#</th>
              <th className="border border-black px-2 py-1 text-left">Item Name</th>
              <th className="border border-black px-2 py-1 text-center w-12">Qty</th>
              <th className="border border-black px-2 py-1 text-left">Serial Numbers</th>
              <th className="border border-black px-2 py-1 text-left">Committee Remarks</th>
            </tr>
          </thead>
          <tbody>
            {destroyedItems.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                <td className="border border-black px-2 py-1 font-medium">{item.item_name}</td>
                <td className="border border-black px-2 py-1 text-center">{item.quantity}</td>
                <td className="border border-black px-2 py-1 font-mono text-[10px]">
                  {Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
                    ? item.serial_numbers.join(', ')
                    : (item.serial_number || item.item_code || '—')}
                </td>
                <td className="border border-black px-2 py-1">{item.committee_remarks || 'Approved for Destruction'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Witness Signatures */}
      <div className="mt-8 pt-4 border-t-2 border-black page-break-inside-avoid">
        <p className="font-bold text-xs uppercase tracking-wider mb-2">
          Witness Certification
        </p>
        <p className="text-[11px] mb-6 italic">
          We hereby certify that the assets detailed above were completely destroyed in our presence on the specified date in accordance with the decision of the Board of Survey Committee (Ref: {request.committee_decision?.report_ref || 'BOS'}).
        </p>

        <div className="grid grid-cols-3 gap-6">
          {witnesses.map((wName, idx) => (
            <div key={idx} className="border-t border-black pt-2 text-center text-[11px]">
              <p className="font-bold">{wName}</p>
              <p className="text-gray-700">Witness / Authorized Officer</p>
              <p className="mt-6 text-[10px] text-gray-500">Date: ________________________</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


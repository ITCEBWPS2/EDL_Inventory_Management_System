import React from 'react';
import { PrintHeader } from '../common/PrintHeader';
import { formatDate } from '../../utils/formatters';

export const WayBillPrint = ({ request, record }) => {
  if (!request || !record) return null;

  const releasedItems = request.items?.filter(i => record.item_ids?.includes(String(i.id))) || [];

  return (
    <div className="print-report-container p-6 bg-white text-black font-sans text-xs leading-normal">
      <PrintHeader
        reportTitle="Tender Asset Release / Way Bill Note"
        subtitle="Electricity Distribution Lanka (Pvt) Ltd"
        unitOverride={request.unit_name || request.unit_id}
      />

      <div className="border border-black p-3 my-4 space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-bold text-black"><strong>Way Bill No:</strong> {record.waybill_no || '—'}</p>
            {record.reference && record.reference !== record.waybill_no && (
              <p><strong>Tender Release Ref:</strong> {record.reference}</p>
            )}
            <p><strong>Originating Unit:</strong> {request.unit_name || request.unit_id}</p>
          </div>
          <div>
            <p><strong>Way Bill Release Date:</strong> {formatDate(record.date)}</p>
            <p><strong>Authority (Committee Report Ref):</strong> {request.committee_decision?.report_ref || 'Board of Survey'}</p>
            <p><strong>Disposal Request No:</strong> {request.request_no}</p>
          </div>
        </div>
        {record.remarks && <p><strong>Release Details / Purchaser:</strong> {record.remarks}</p>}
      </div>

      <div className="my-4">
        <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">
          Released Assets (Tender / Auction / Sale)
        </h3>
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-1 text-center w-8">#</th>
              <th className="border border-black px-2 py-1 text-left">Item Name</th>
              <th className="border border-black px-2 py-1 text-center w-12">Qty</th>
              <th className="border border-black px-2 py-1 text-left">Serial Numbers</th>
              <th className="border border-black px-2 py-1 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {releasedItems.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                <td className="border border-black px-2 py-1 font-medium">{item.item_name}</td>
                <td className="border border-black px-2 py-1 text-center">{item.quantity}</td>
                <td className="border border-black px-2 py-1 font-mono text-[10px]">
                  {Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
                    ? item.serial_numbers.join(', ')
                    : (item.serial_number || item.item_code || '—')}
                </td>
                <td className="border border-black px-2 py-1">{item.committee_remarks || 'Approve for Tender'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Release Signatures */}
      <div className="mt-8 pt-4 border-t-2 border-black page-break-inside-avoid">
        <div className="grid grid-cols-3 gap-6 text-[11px]">
          <div className="border-t border-black pt-2 text-center">
            <p className="font-bold">Storekeeper / Dispatcher</p>
            <p className="text-gray-600 mt-6">Signature &amp; Date</p>
          </div>
          <div className="border-t border-black pt-2 text-center">
            <p className="font-bold">Authorized Transport / Purchaser</p>
            <p className="text-gray-600 mt-6">Signature &amp; Date</p>
          </div>
          <div className="border-t border-black pt-2 text-center">
            <p className="font-bold">Security Gate Officer</p>
            <p className="text-gray-600 mt-6">Gate Pass Verified &amp; Date</p>
          </div>
        </div>
      </div>
    </div>
  );
};


import React from 'react';

export const StatusBadge = ({ status, type }) => {
  const norm = (status || type || '').toString().toLowerCase();

  let bgClass = 'bg-[#8a7a80]/12 text-[#8a7a80]';
  let dotClass = 'bg-[#8a7a80]';

  if (norm === 'issued' || norm.startsWith('issue')) {
    bgClass = 'bg-[#2e7d58]/12 text-[#2e7d58] border border-[#2e7d58]/40';
    dotClass = 'bg-[#2e7d58]';
  } else if (norm === 'board appointed' || norm === 'board_appointed') {
    bgClass = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    dotClass = 'bg-indigo-600';
  } else if (norm === 'submitted') {
    bgClass = 'bg-sky-50 text-sky-700 border border-sky-200';
    dotClass = 'bg-sky-600';
  } else if (norm === 'approved' || norm === 'approve for tender') {
    bgClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    dotClass = 'bg-emerald-600';
  } else if (norm === 'approve for destruction') {
    bgClass = 'bg-rose-50 text-rose-700 border border-rose-200';
    dotClass = 'bg-rose-600';
  } else if (norm === 'in disposal' || norm === 'in_disposal') {
    bgClass = 'bg-amber-50 text-amber-800 border border-amber-200';
    dotClass = 'bg-amber-600';
  } else if (norm === 'completed') {
    bgClass = 'bg-teal-50 text-teal-800 border border-teal-200';
    dotClass = 'bg-teal-600';
  } else if (norm === 'rejected' || norm === 'reject') {
    bgClass = 'bg-rose-50 text-rose-700 border border-rose-200';
    dotClass = 'bg-rose-600';
  } else if (norm === 'retain') {
    bgClass = 'bg-slate-100 text-slate-700 border border-slate-300';
    dotClass = 'bg-slate-500';
  } else if (norm === 'repair') {
    bgClass = 'bg-amber-50 text-amber-700 border border-amber-300';
    dotClass = 'bg-amber-600';
  } else if (norm === 'destroyed' || norm === 'scrapped' || norm.startsWith('destroy')) {
    bgClass = 'bg-[#b33947]/12 text-[#b33947] border border-[#b33947]/40';
    dotClass = 'bg-[#b33947]';
  } else if (
    norm.includes('in') ||
    norm.includes('received') ||
    norm.includes('confirmed') ||
    norm.includes('good') ||
    norm.includes('active') ||
    norm.includes('counted') ||
    norm.includes('up to date')
  ) {
    bgClass = 'bg-[#2e7d58]/12 text-[#2e7d58]';
    dotClass = 'bg-[#2e7d58]';
  } else if (
    norm.includes('out') ||
    norm.includes('expended') ||
    norm.includes('alert') ||
    norm.includes('discrepancy') ||
    norm.includes('damaged') ||
    norm.includes('inactive') ||
    norm.includes('written off') ||
    norm.includes('overdue')
  ) {
    bgClass = 'bg-[#b33947]/12 text-[#b33947]';
    dotClass = 'bg-[#b33947]';
  } else if (
    norm.includes('transfer') ||
    norm.includes('auction') ||
    norm.includes('progress') ||
    norm.includes('draft') ||
    norm.includes('fair') ||
    norm.includes('not counted') ||
    norm.includes('not started')
  ) {
    bgClass = 'bg-[#8a7a80]/12 text-[#8a7a80]';
    dotClass = 'bg-[#8a7a80]';
  } else if (norm.includes('low stock') || norm.includes('needs repair') || norm.includes('due soon')) {
    bgClass = 'bg-[#f6c026]/15 text-[#a67c13]';
    dotClass = 'bg-[#f6c026]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold tracking-wide ${bgClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
      {status || type}
    </span>
  );
};

export default StatusBadge;

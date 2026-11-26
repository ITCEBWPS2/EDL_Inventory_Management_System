import React from 'react';

export const StatusBadge = ({ status, type }) => {
  const norm = (status || type || '').toString().toLowerCase().trim();

  let bgClass = 'bg-[#EEEAE8] text-[#4A4D5A] border border-[#DDD8D5]';
  let dotClass = 'bg-[#4A4D5A]';

  // Specific Disposal Workflow Statuses & Committee Decisions (EDL Brand Palette)
  if (norm === 'draft') {
    bgClass = 'bg-[#EEEAE8] text-[#4A4D5A] border border-[#DDD8D5]';
    dotClass = 'bg-[#4A4D5A]';
  } else if (norm === 'submitted') {
    bgClass = 'bg-[#FFF4D6] text-[#7A5600] border border-[#F4B731]/40';
    dotClass = 'bg-[#7A5600]';
  } else if (norm === 'board appointed' || norm === 'board_appointed') {
    bgClass = 'bg-[#F7E9EE] text-[#7B1C3E] border border-[#7B1C3E]/30';
    dotClass = 'bg-[#7B1C3E]';
  } else if (norm === 'approved') {
    bgClass = 'bg-[#F4B731] text-[#3A2A00] border border-[#DE9E16] font-bold';
    dotClass = 'bg-[#3A2A00]';
  } else if (norm === 'in disposal' || norm === 'in_disposal') {
    bgClass = 'bg-[#EBD3DC] text-[#5B1A3A] border border-[#7B1C3E]/30';
    dotClass = 'bg-[#5B1A3A]';
  } else if (norm === 'completed') {
    bgClass = 'bg-[#7B1C3E] text-white border border-[#5B1A3A]';
    dotClass = 'bg-white';
  } else if (norm === 'rejected' || norm === 'reject') {
    bgClass = 'bg-white text-[#B3261E] border border-[#B3261E]';
    dotClass = 'bg-[#B3261E]';
  } else if (norm === 'approve for destruction' || norm === 'approve for destroy') {
    bgClass = 'bg-[#F7E9EE] text-[#7B1C3E] border border-[#7B1C3E]/30';
    dotClass = 'bg-[#7B1C3E]';
  } else if (norm === 'approve for tender') {
    bgClass = 'bg-[#FFF4D6] text-[#7A5600] border border-[#F4B731]/40';
    dotClass = 'bg-[#7A5600]';
  } else if (norm === 'retain') {
    bgClass = 'bg-[#EEEAE8] text-[#4A4D5A] border border-[#DDD8D5]';
    dotClass = 'bg-[#4A4D5A]';
  } else if (norm === 'repair') {
    bgClass = 'bg-white text-[#7B1C3E] border border-[#7B1C3E]';
    dotClass = 'bg-[#7B1C3E]';
  } else if (norm === 'issued' || norm.startsWith('issue')) {
    bgClass = 'bg-[#2e7d58]/12 text-[#2e7d58] border border-[#2e7d58]/40';
    dotClass = 'bg-[#2e7d58]';
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
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${bgClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}></span>
      <span className="leading-none">{status || type}</span>
    </span>
  );
};

export default StatusBadge;

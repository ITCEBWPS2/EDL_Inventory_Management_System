import React from 'react';

export const StatusBadge = ({ status, type }) => {
  const norm = (status || type || '').toString().toLowerCase();

  let bgClass = 'bg-slate/10 text-slate';
  let dotClass = 'bg-slate';

  if (norm === 'issued' || norm.startsWith('issue')) {
    bgClass = 'bg-[#2F7A5C]/10 text-[#2F7A5C] border border-[#2F7A5C]/50';
    dotClass = 'bg-[#2F7A5C]';
  } else if (norm === 'destroyed' || norm === 'scrapped' || norm.startsWith('destroy')) {
    bgClass = 'bg-[#B4483A]/10 text-[#B4483A] border border-[#B4483A]/50';
    dotClass = 'bg-[#B4483A]';
  } else if (
    norm.includes('in') ||
    norm.includes('received') ||
    norm.includes('confirmed') ||
    norm.includes('good') ||
    norm.includes('active') ||
    norm.includes('counted')
  ) {
    bgClass = 'bg-[#2F7A5C]/15 text-[#2F7A5C]';
    dotClass = 'bg-[#2F7A5C]';
  } else if (
    norm.includes('out') ||
    norm.includes('expended') ||
    norm.includes('alert') ||
    norm.includes('discrepancy') ||
    norm.includes('damaged') ||
    norm.includes('inactive') ||
    norm.includes('written off')
  ) {
    bgClass = 'bg-[#B4483A]/15 text-[#B4483A]';
    dotClass = 'bg-[#B4483A]';
  } else if (
    norm.includes('transfer') ||
    norm.includes('auction') ||
    norm.includes('progress') ||
    norm.includes('draft') ||
    norm.includes('fair') ||
    norm.includes('not counted')
  ) {
    bgClass = 'bg-[#5B6B7C]/15 text-[#5B6B7C]';
    dotClass = 'bg-[#5B6B7C]';
  } else if (norm.includes('low stock') || norm.includes('needs repair')) {
    bgClass = 'bg-[#E8A23A]/15 text-[#D6922C]';
    dotClass = 'bg-[#E8A23A]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold tracking-wide ${bgClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
      {status || type}
    </span>
  );
};

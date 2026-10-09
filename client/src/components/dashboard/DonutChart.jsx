import React, { useState } from 'react';
import { formatNumber } from '../../utils/formatters';

const PALETTE = [
  '#E8A23A', // --signal (lead segment)
  '#10233B', // --ink
  '#2F7A5C', // deep field-green
  '#5B6B7C', // --slate
  '#3A6D8C', // utility steel blue
  '#8E9AAF', // calm slate grey
  '#D4A373'  // earthen amber
];

export const DonutChart = ({ data = [], title = 'Category Breakdown' }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = data.reduce((sum, d) => sum + Number(d.quantity || 0), 0);

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="bg-card rounded-xl border border-line p-5 shadow-subtle flex flex-col items-center justify-center min-h-[280px]">
        <div className="text-xs text-slate">No inventory data available for chart</div>
      </div>
    );
  }

  // Calculate SVG arc paths
  const radius = 64;
  const strokeWidth = 22;
  const center = 80;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="bg-card rounded-xl border border-line p-5 shadow-subtle flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="text-xs text-slate tabular-nums">{data.length} Categories</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 justify-around py-2">
        {/* SVG Donut Chart */}
        <div className="relative w-40 h-40 shrink-0">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            {data.map((item, idx) => {
              const percent = Number(item.quantity || 0) / total;
              const strokeDasharray = `${percent * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedPercent * circumference;
              accumulatedPercent += percent;
              const color = PALETTE[idx % PALETTE.length];
              const isHovered = hoveredIdx === idx;

              return (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xs text-slate">Total</span>
            <span className="text-base font-semibold text-ink tabular-nums leading-tight">
              {formatNumber(total)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {data.map((item, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const pct = Math.round((Number(item.quantity) / total) * 100) || 0;
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between text-xs p-1 rounded transition-colors cursor-pointer ${
                  isHovered ? 'bg-surface font-medium' : 'text-slate'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                  <span className="truncate text-ink">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="font-semibold text-ink">{formatNumber(item.quantity)}</span>
                  <span className="text-[11px] text-slate w-7 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

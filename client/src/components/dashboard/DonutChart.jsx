import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatNumber } from '../../utils/formatters';
import { AlertCircle, RotateCcw, ExternalLink } from 'lucide-react';

const PALETTE = [
  '#7a1a3c', // wine
  '#f6c026', // gold
  '#3b0c20', // deep
  '#a8707f', // rose
  '#b9a99f', // taupe
  '#5a1230', // maroon
  '#c89b3c'  // warm amber
];

export const slugifyCategory = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export const DonutChart = ({
  data = [],
  title = 'Stock Distribution by Category',
  loading = false,
  error = false,
  onRetry = null,
  className = ''
}) => {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (loading) {
    return (
      <div className={`glass-card p-4 sm:p-[18px] flex flex-col justify-between min-h-[220px] animate-pulse ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-white/60 rounded w-44"></div>
          <div className="h-3 bg-white/60 rounded w-20"></div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-around py-1">
          <div className="w-[150px] h-[150px] rounded-full border-8 border-white/60 shrink-0"></div>
          <div className="flex-1 w-full space-y-2">
            <div className="h-3.5 bg-white/60 rounded w-full"></div>
            <div className="h-3.5 bg-white/60 rounded w-5/6"></div>
            <div className="h-3.5 bg-white/60 rounded w-4/6"></div>
            <div className="h-3.5 bg-white/60 rounded w-3/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass-card p-4 sm:p-[18px] flex flex-col items-center justify-center min-h-[220px] text-center ${className}`}>
        <AlertCircle className="w-5 h-5 text-[#b33947] mb-1.5" />
        <div className="text-xs font-semibold text-[#280818] mb-1">Unable to load category distribution</div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#7a1a3c] hover:underline font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + Number(d.quantity || 0), 0);
  const displayData = (data || [])
    .filter(d => Number(d.quantity || 0) > 0)
    .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));

  if (!data || data.length === 0 || total === 0 || displayData.length === 0) {
    return (
      <div className={`glass-card p-4 sm:p-[18px] flex flex-col items-center justify-center min-h-[220px] ${className}`}>
        <div className="text-xs text-[#5a1230] font-medium">No inventory items yet.</div>
      </div>
    );
  }

  // Calculate SVG arc paths
  const radius = 62;
  const strokeWidth = 20;
  const center = 80;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const handleCategoryClick = (categoryName) => {
    const slug = slugifyCategory(categoryName);
    if (slug) {
      navigate(`/inventory/category/${slug}`);
    }
  };

  return (
    <div className={`glass-card p-4 sm:p-[18px] flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#280818]">{title}</h3>
          <p className="text-xs text-[#4A4D5A] mt-0.5">Items in inventory by category</p>
        </div>
        <span className="text-xs text-[#4A4D5A] tabular-nums font-medium">
          {displayData.length} Categories
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-around py-1 my-auto">
        {/* SVG Donut Chart (about 150px) */}
        <div className="relative w-[150px] h-[150px] shrink-0">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            {displayData.map((item, idx) => {
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
                  onClick={() => handleCategoryClick(item.name)}
                >
                  <title>{`${item.name}: ${formatNumber(item.quantity)} (${Math.round(percent * 100)}%) - Click to view items`}</title>
                </circle>
              );
            })}
          </svg>

          {/* Center text "TOTAL" with grand total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] font-bold text-[#4A4D5A] uppercase tracking-wider">TOTAL</span>
            <span className="text-lg font-bold text-[#280818] tabular-nums leading-tight">
              {formatNumber(total)}
            </span>
          </div>
        </div>

        {/* Legend (rows about 32px high) */}
        <div className="flex-1 w-full space-y-1 max-h-[170px] overflow-y-auto pr-1">
          {displayData.map((item, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const pct = item.percentage !== undefined
              ? Math.round(Number(item.percentage))
              : (Math.round((Number(item.quantity) / total) * 100) || 0);
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => handleCategoryClick(item.name)}
                title="View items"
                className={`group flex items-center justify-between text-xs py-1.5 px-2 rounded-md h-[32px] transition-all cursor-pointer border ${
                  isHovered
                    ? 'bg-white/80 border-[rgba(27,27,36,0.12)] shadow-xs'
                    : 'border-transparent hover:bg-[rgba(123,28,62,0.06)] text-[#4A4D5A]'
                }`}
              >
                <div className="flex items-center gap-2 truncate mr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-125"
                    style={{ backgroundColor: color }}
                  ></span>
                  <span className="truncate text-[#280818] font-medium group-hover:text-[#7a1a3c] transition-colors">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="font-semibold text-[#280818]">{formatNumber(item.quantity)}</span>
                  <span className="text-[11px] text-[#4A4D5A] w-7 text-right font-mono">{pct}%</span>
                  <ExternalLink className="w-3 h-3 text-[#4A4D5A]/50 group-hover:text-[#7a1a3c] transition-colors shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DonutChart;

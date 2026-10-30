import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { EnergyHistoryPoint } from '../../types';

export type DailyEnergyPoint = EnergyHistoryPoint;

export const FleetEnergyChart: React.FC<{ data?: EnergyHistoryPoint[] }> = ({
  data = [],
}) => {
  // Safe hovered index
  const defaultIdx = data.length > 0 ? Math.min(data.length - 1, 10) : 0;
  const [hoveredIndex, setHoveredIndex] = useState<number>(defaultIdx);
  const timeRange = 'Last 14 days';

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E3E4E6] p-5 shadow-xs flex flex-col justify-center items-center h-[260px]">
        <p className="text-xs text-[#888888]">Loading live telemetry energy data...</p>
      </div>
    );
  }

  // Dynamic Chart Geometry & Limits based on actual data
  const values = data.map((d) => d.kwh);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const minY = Math.max(0, Math.floor((rawMin - 50) / 50) * 50);
  const maxY = Math.max(minY + 100, Math.ceil((rawMax + 50) / 50) * 50);
  const step = (maxY - minY) / 5;
  const yTicks = [
    maxY,
    Math.round(maxY - step),
    Math.round(maxY - step * 2),
    Math.round(maxY - step * 3),
    Math.round(maxY - step * 4),
    minY,
  ];

  const svgWidth = 700;
  const svgHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  // Coordinate mapping
  const getX = (index: number) =>
    paddingLeft + (data.length > 1 ? (index / (data.length - 1)) * plotWidth : plotWidth / 2);
  const getY = (val: number) =>
    paddingTop + plotHeight * (1 - (val - minY) / Math.max(maxY - minY, 1));

  // Build smooth bezier path
  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.kwh) }));

  // Catmull-Rom or Bezier curve generator
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  // Area path closing to bottom
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    paddingTop + plotHeight
  } L ${points[0].x} ${paddingTop + plotHeight} Z`;

  const safeHoverIdx = hoveredIndex >= 0 && hoveredIndex < points.length ? hoveredIndex : 0;
  const activePoint = points[safeHoverIdx] || points[0];
  const activeData = data[safeHoverIdx] || data[0];


  return (
    <div className="bg-white rounded-xl border border-[#E3E4E6] p-5 shadow-xs">
      {/* Header: Title + Subtitle + Time Dropdown */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-sm font-extrabold text-[#171717] tracking-tight">
            Energy usage
          </h2>
          <p className="text-xs text-[#888888] mt-0.5">
            kWh per day, all machines
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E3E4E6] text-xs font-semibold text-[#171717] bg-white hover:bg-[#F8F9FA] transition-colors cursor-pointer"
          >
            <span>{timeRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#666666]" />
          </button>
        </div>
      </div>

      {/* SVG Smooth Area Curve Chart */}
      <div className="relative w-full overflow-hidden mt-1 select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Smooth Blue Gradient */}
            <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#3B82F6" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines & Y-Axis Labels */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#9CA3AF] text-[10px] font-medium"
                >
                  {tick}
                </text>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#F3F4F6"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* Gradient Area Fill */}
          <path d={areaPath} fill="url(#energyGradient)" />

          {/* Smooth Blue Stroke Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Active Guide Dashed Vertical Line */}
          <line
            x1={activePoint.x}
            y1={paddingTop}
            x2={activePoint.x}
            y2={paddingTop + plotHeight}
            stroke="#3B82F6"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Active Circle Dot on Curve */}
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="4.5"
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            className="filter drop-shadow-xs"
          />

          {/* Tooltip Card over active point */}
          <g transform={`translate(${activePoint.x}, ${Math.max(activePoint.y - 48, paddingTop - 10)})`}>
            {/* Tooltip Bubble Box */}
            <rect
              x="-42"
              y="-10"
              width="84"
              height="40"
              rx="6"
              fill="#111827"
              className="filter drop-shadow-md"
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              className="fill-[#9CA3AF] text-[9.5px] font-medium"
            >
              {activeData.fullDate}
            </text>
            <text
              x="0"
              y="22"
              textAnchor="middle"
              className="fill-white text-[12px] font-extrabold"
            >
              {activeData.kwh} kWh
            </text>
          </g>

          {/* X-Axis Date Labels */}
          {data.map((d, i) => {
            const x = getX(i);
            const isSelected = i === hoveredIndex;
            return (
              <text
                key={d.date}
                x={x}
                y={svgHeight - 8}
                textAnchor="middle"
                className={`text-[9.5px] transition-colors cursor-pointer ${
                  isSelected ? 'fill-[#171717] font-bold' : 'fill-[#9CA3AF]'
                }`}
                onClick={() => setHoveredIndex(i)}
              >
                {d.displayDate}
              </text>
            );
          })}

          {/* Invisible interactive hover rects for smooth hovering across all 14 days */}
          {data.map((_, i) => {
            const x = getX(i);
            const w = plotWidth / (data.length - 1);
            return (
              <rect
                key={i}
                x={x - w / 2}
                y={paddingTop}
                width={w}
                height={plotHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Area,
  ReferenceLine,
} from 'recharts';
import { colors, chartConfig } from '../../design-system/tokens';

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface ComparisonChartProps {
  data: DataPoint[];
  type?: 'bar' | 'line' | 'composed';
  baseKey: string;
  compareKey?: string;
  baseLabel?: string;
  compareLabel?: string;
  title: string;
  subtitle?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  yAxisDomain?: [number, number];
  formatValue?: (value: number) => string;
  comparisonMode?: boolean;
}

export default function ComparisonChart({
  data,
  type = 'bar',
  baseKey,
  compareKey,
  baseLabel = 'Current',
  compareLabel = 'Previous',
  title,
  subtitle,
  height = 280,
  showLegend = true,
  showGrid = false,
  yAxisDomain,
  formatValue = (v) => v.toLocaleString(),
  comparisonMode = false,
}: ComparisonChartProps) {
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#1A2230',
      border: '1px solid rgba(71, 85, 105, 0.4)',
      borderRadius: '12px',
      fontSize: '13px',
      padding: '12px 16px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    },
    labelStyle: {
      color: '#F1F5F9',
      fontWeight: 600,
      marginBottom: '8px',
    },
  };

  const axisStyle = {
    tick: { fill: '#64748B', fontSize: 11 },
    axisLine: { stroke: 'rgba(71, 85, 105, 0.25)' },
    tickLine: false,
  };

  const renderChart = () => {
    if (type === 'line') {
      return (
        <LineChart data={data}>
          <XAxis dataKey="name" {...axisStyle} />
          <YAxis {...axisStyle} domain={yAxisDomain} tickFormatter={formatValue} />
          {showGrid && (
            <defs>
              <pattern id="grid" width="60" height="40" patternUnits="userSpaceOnUse">
                <line x1="0" y1="40" x2="60" y2="40" stroke="rgba(71, 85, 105, 0.15)" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </defs>
          )}
          <Tooltip {...tooltipStyle} formatter={(value: number) => [formatValue(value), '']} />
          {showLegend && <Legend wrapperStyle={{ fontSize: '12px', color: '#CBD5E1' }} />}
          <Line
            type="monotone"
            dataKey={baseKey}
            name={baseLabel}
            stroke="#6366F1"
            strokeWidth={2.5}
            dot={{ fill: '#6366F1', r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
          />
          {comparisonMode && compareKey && (
            <Line
              type="monotone"
              dataKey={compareKey}
              name={compareLabel}
              stroke="#94A3B8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#94A3B8', r: 3, strokeWidth: 0 }}
            />
          )}
        </LineChart>
      );
    }

    if (type === 'composed') {
      return (
        <ComposedChart data={data}>
          <XAxis dataKey="name" {...axisStyle} />
          <YAxis {...axisStyle} domain={yAxisDomain} tickFormatter={formatValue} />
          <Tooltip {...tooltipStyle} formatter={(value: number) => [formatValue(value), '']} />
          {showLegend && <Legend wrapperStyle={{ fontSize: '12px', color: '#CBD5E1' }} />}
          <Bar
            dataKey={baseKey}
            name={baseLabel}
            fill="#6366F1"
            radius={[4, 4, 0, 0]}
            fillOpacity={0.9}
          />
          {comparisonMode && compareKey && (
            <Bar
              dataKey={compareKey}
              name={compareLabel}
              fill="#94A3B8"
              radius={[4, 4, 0, 0]}
              fillOpacity={0.5}
            />
          )}
        </ComposedChart>
      );
    }

    // Default: grouped bar chart
    return (
      <BarChart data={data} barGap={comparisonMode ? 4 : 0}>
        <XAxis dataKey="name" {...axisStyle} />
        <YAxis {...axisStyle} domain={yAxisDomain} tickFormatter={formatValue} />
        <Tooltip {...tooltipStyle} formatter={(value: number) => [formatValue(value), '']} />
        {showLegend && <Legend wrapperStyle={{ fontSize: '12px', color: '#CBD5E1' }} />}
        <Bar
          dataKey={baseKey}
          name={baseLabel}
          fill="#6366F1"
          radius={[4, 4, 0, 0]}
          maxBarSize={comparisonMode ? 28 : 40}
        />
        {comparisonMode && compareKey && (
          <Bar
            dataKey={compareKey}
            name={compareLabel}
            fill="#94A3B8"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        )}
      </BarChart>
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {comparisonMode && (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-500" />
              <span className="text-slate-400">{baseLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-500" />
              <span className="text-slate-400">{compareLabel}</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

// Side-by-side comparison variant
interface SideBySideChartProps {
  leftData: DataPoint[];
  rightData: DataPoint[];
  dataKey: string;
  leftLabel: string;
  rightLabel: string;
  title: string;
  height?: number;
}

export function SideBySideChart({
  leftData,
  rightData,
  dataKey,
  leftLabel,
  rightLabel,
  title,
  height = 220,
}: SideBySideChartProps) {
  const axisStyle = {
    tick: { fill: '#64748B', fontSize: 10 },
    axisLine: { stroke: 'rgba(71, 85, 105, 0.25)' },
    tickLine: false,
  };

  return (
    <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-6">
      <h3 className="text-base font-semibold text-slate-100 mb-5">{title}</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Chart */}
        <div>
          <p className="text-xs font-medium text-indigo-400 mb-3 text-center">{leftLabel}</p>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={leftData}>
              <XAxis dataKey="name" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A2230',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey={dataKey} fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right Chart */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-3 text-center">{rightLabel}</p>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={rightData}>
              <XAxis dataKey="name" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A2230',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey={dataKey} fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

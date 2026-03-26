import { useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { toPng } from 'html-to-image';
import { chartTheme } from './chartTheme';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from './EmptyState';

function LegendToggle({ label, color, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] transition ${
        active
          ? 'border-slate-300 bg-white/80 text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200'
          : 'border-slate-200 bg-slate-100/80 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500'
      }`}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </button>
  );
}

function ChartCard({ title, chartKey, children, legends = [], visibility, onToggle }) {
  const cardRef = useRef(null);

  const onExport = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `${chartKey}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // noop
    }
  };

  return (
    <div ref={cardRef} className="glass-panel hover-lift enter-up rounded-2xl p-5 shadow-soft transition hover:shadow-xl hover:shadow-brand-500/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300">{title}</h3>
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg border border-slate-300 bg-white/80 px-2.5 py-1.5 text-xs transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800"
        >
          Export PNG
        </button>
      </div>
      {legends.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {legends.map((item) => (
            <LegendToggle
              key={`${chartKey}-${item.key}`}
              label={item.label}
              color={item.color}
              active={visibility[item.key]}
              onClick={() => onToggle(item.key)}
            />
          ))}
        </div>
      ) : null}
      <div className="h-72">{children}</div>
    </div>
  );
}

function buildDauComparison(currentSeries, previousSeries) {
  const maxLen = Math.max(currentSeries.length, previousSeries.length);
  const out = [];

  for (let i = 0; i < maxLen; i += 1) {
    const curr = currentSeries[i];
    const prev = previousSeries[i];
    out.push({
      date: curr?.date || prev?.date || `Day ${i + 1}`,
      users: curr?.users || 0,
      previousUsers: prev?.users || 0
    });
  }

  return out;
}

export function ChartsPanel({ eventsData, previousEventsData }) {
  const [visibility, setVisibility] = useState({
    users: true,
    previousUsers: true,
    sessions: true,
    engagement: true,
    clicks: true
  });

  const toggle = (key) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const dauSeries = eventsData?.dailyActiveUsers || [];
  const prevDauSeries = previousEventsData?.dailyActiveUsers || [];
  const dau = useMemo(() => buildDauComparison(dauSeries, prevDauSeries), [dauSeries, prevDauSeries]);

  const featureUsage = eventsData?.featureUsage || [];
  const duration = eventsData?.sessionDurationDistribution || [];
  const heatmap = eventsData?.engagementHeatmap || [];

  const hasData = dau.length || featureUsage.length || duration.length || heatmap.length;

  if (!hasData) {
    return <EmptyState title="No chart data yet" subtitle="Track some user activity to populate analytics charts." />;
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartCard
        title="Daily Active Users"
        chartKey="daily-active-users"
        legends={[
          { key: 'users', label: 'Current period', color: chartTheme.colors.users },
          { key: 'previousUsers', label: 'Previous period', color: chartTheme.colors.usersSoft }
        ]}
        visibility={visibility}
        onToggle={toggle}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dau} margin={{ top: 6, right: 14, left: -12, bottom: 8 }}>
            <defs>
              <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartTheme.colors.users} stopOpacity={0.85} />
                <stop offset="95%" stopColor={chartTheme.colors.usersSoft} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartTheme.colors.text }} tickMargin={8} />
            <YAxis tick={{ fontSize: 11, fill: chartTheme.colors.text }} tickMargin={8} />
            <Tooltip content={<ChartTooltip title="Daily Users" />} />
            {visibility.previousUsers ? (
              <Area
                type="monotone"
                dataKey="previousUsers"
                name="Previous"
                stroke={chartTheme.colors.usersSoft}
                strokeWidth={2}
                fill="transparent"
                isAnimationActive
                animationDuration={chartTheme.animation.duration}
                animationEasing={chartTheme.animation.easing}
              />
            ) : null}
            {visibility.users ? (
              <Area
                type="monotone"
                dataKey="users"
                name="Current"
                stroke={chartTheme.colors.users}
                strokeWidth={2.4}
                fill="url(#dauGrad)"
                isAnimationActive
                animationDuration={chartTheme.animation.duration}
                animationEasing={chartTheme.animation.easing}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Session Duration Distribution (seconds)"
        chartKey="session-duration"
        legends={[{ key: 'sessions', label: 'Sessions', color: chartTheme.colors.sessions }]}
        visibility={visibility}
        onToggle={toggle}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={duration.map((d) => ({ range: `${Math.round(d.rangeStartSec)}-${Math.round(d.rangeEndSec)}`, count: d.count }))}
            margin={{ top: 6, right: 14, left: -12, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
            <XAxis dataKey="range" tick={{ fontSize: 11, fill: chartTheme.colors.text }} tickMargin={8} />
            <YAxis tick={{ fontSize: 11, fill: chartTheme.colors.text }} tickMargin={8} />
            <Tooltip content={<ChartTooltip title="Session Buckets" valueSuffix=" sessions" />} />
            {visibility.sessions ? (
              <Bar
                dataKey="count"
                name="Sessions"
                fill={chartTheme.colors.sessions}
                radius={[8, 8, 0, 0]}
                isAnimationActive
                animationDuration={chartTheme.animation.duration}
                animationEasing={chartTheme.animation.easing}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Feature Usage"
        chartKey="feature-usage"
        legends={[{ key: 'engagement', label: 'Feature interactions', color: chartTheme.colors.engagement }]}
        visibility={visibility}
        onToggle={toggle}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={featureUsage} margin={{ top: 6, right: 14, left: -12, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
            <XAxis dataKey="feature" tick={{ fontSize: 11, fill: chartTheme.colors.text }} tickMargin={8} />
            <YAxis tick={{ fontSize: 11, fill: chartTheme.colors.text }} tickMargin={8} />
            <Tooltip content={<ChartTooltip title="Feature Interactions" valueSuffix=" events" />} />
            {visibility.engagement ? (
              <Bar
                dataKey="count"
                name="Interactions"
                fill={chartTheme.colors.engagement}
                radius={[8, 8, 0, 0]}
                isAnimationActive
                animationDuration={chartTheme.animation.duration}
                animationEasing={chartTheme.animation.easing}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Engagement Heatmap (by hour)"
        chartKey="engagement-heatmap"
        legends={[{ key: 'clicks', label: 'Interactions', color: chartTheme.colors.clicks }]}
        visibility={visibility}
        onToggle={toggle}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={heatmap.map((h) => ({ key: `${h.date} ${h.hour}:00`, interactions: h.interactions }))}
            margin={{ top: 6, right: 14, left: -12, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
            <XAxis dataKey="key" hide />
            <YAxis tick={{ fontSize: 11, fill: chartTheme.colors.text }} tickMargin={8} />
            <Tooltip content={<ChartTooltip title="Hourly Engagement" valueSuffix=" interactions" />} />
            {visibility.clicks ? (
              <Bar
                dataKey="interactions"
                name="Interactions"
                radius={[8, 8, 0, 0]}
                isAnimationActive
                animationDuration={chartTheme.animation.duration}
                animationEasing={chartTheme.animation.easing}
              >
                {heatmap.map((entry, idx) => (
                  <Cell
                    key={`${entry.date}-${entry.hour}`}
                    fill={idx % 2 ? chartTheme.colors.clicks : chartTheme.colors.sessions}
                  />
                ))}
              </Bar>
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

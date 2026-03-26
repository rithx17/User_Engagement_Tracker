import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { analyticsService } from '../services/analyticsService';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { StatCard } from '../components/StatCard';
import { ChartsSkeleton, StatCardsSkeleton, TablesSkeleton } from '../dashboard/Skeletons';
import { useAnalyticsCache } from '../hooks/useAnalyticsCache';
import { useAuth } from '../context/AuthContext';

const ChartsPanel = lazy(() => import('../dashboard/ChartsPanel').then((m) => ({ default: m.ChartsPanel })));
const TablesPanel = lazy(() => import('../dashboard/TablesPanel').then((m) => ({ default: m.TablesPanel })));

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function presetToRange(preset) {
  const now = new Date();
  const endDate = toDateInput(now);

  if (preset === 'today') {
    return { startDate: endDate, endDate };
  }

  const days = preset === '7d' ? 7 : 30;
  const past = new Date(now.getTime() - 1000 * 60 * 60 * 24 * days);
  return { startDate: toDateInput(past), endDate };
}

function previousRange(currentRange) {
  const start = new Date(`${currentRange.startDate}T00:00:00`);
  const end = new Date(`${currentRange.endDate}T23:59:59`);
  const diffMs = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diffMs + 1);

  return {
    startDate: toDateInput(prevStart),
    endDate: toDateInput(prevEnd)
  };
}

function trend(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return { value: ((current - previous) / previous) * 100 };
}

const quickRanges = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'custom', label: 'Custom' }
];

export function DashboardPage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState(() => presetToRange('30d'));
  const [overview, setOverview] = useState(null);
  const [eventsData, setEventsData] = useState(null);
  const [prevOverview, setPrevOverview] = useState(null);
  const [prevEventsData, setPrevEventsData] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const { fetchWithCache, invalidate } = useAnalyticsCache();

  const loadDashboard = useCallback(
    async ({ force = false } = {}) => {
      setError('');
      setLoadingOverview(true);
      setLoadingEvents(true);

      const keySuffix = `${range.startDate}_${range.endDate}`;
      const prev = previousRange(range);
      const prevKeySuffix = `${prev.startDate}_${prev.endDate}`;

      try {
        const [overviewRes, eventsRes, prevOverviewRes, prevEventsRes] = await Promise.all([
          fetchWithCache(
            `overview_${keySuffix}`,
            () => analyticsService.getOverview(range.startDate, range.endDate),
            { ttlMs: 60_000, force }
          ),
          fetchWithCache(
            `events_${keySuffix}`,
            () => analyticsService.getEvents(range.startDate, range.endDate),
            { ttlMs: 45_000, force }
          ),
          fetchWithCache(
            `overview_${prevKeySuffix}`,
            () => analyticsService.getOverview(prev.startDate, prev.endDate),
            { ttlMs: 60_000, force }
          ),
          fetchWithCache(
            `events_${prevKeySuffix}`,
            () => analyticsService.getEvents(prev.startDate, prev.endDate),
            { ttlMs: 45_000, force }
          )
        ]);

        setOverview(overviewRes.data);
        setEventsData(eventsRes.data);
        setPrevOverview(prevOverviewRes.data);
        setPrevEventsData(prevEventsRes.data);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingOverview(false);
        setLoadingEvents(false);
      }
    },
    [fetchWithCache, range.endDate, range.startDate]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onPresetChange = (nextPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== 'custom') {
      setRange(presetToRange(nextPreset));
    }
  };

  const onRefresh = async () => {
    setNotice('');
    invalidate();
    await loadDashboard({ force: true });
  };

  const onGenerateDemoData = async () => {
    setError('');
    setNotice('');
    setSeedingDemo(true);

    try {
      const res = await analyticsService.generateDemoData();
      setNotice(`Demo data generated: ${res.events || 0} events`);
      invalidate();
      await loadDashboard({ force: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSeedingDemo(false);
    }
  };

  const cards = useMemo(() => {
    if (!overview) return [];

    return [
      {
        title: 'Total Users',
        value: overview.totalUsers,
        icon: 'users',
        trend: trend(overview.totalUsers, prevOverview?.totalUsers)
      },
      {
        title: 'Active Users',
        value: overview.activeUsers,
        icon: 'active',
        trend: trend(overview.activeUsers, prevOverview?.activeUsers)
      },
      {
        title: 'Avg Session Duration',
        value: overview.avgSessionDurationSeconds,
        suffix: 's',
        icon: 'time',
        decimals: 1,
        trend: trend(overview.avgSessionDurationSeconds, prevOverview?.avgSessionDurationSeconds)
      },
      {
        title: 'Bounce Rate',
        value: overview.bounceRate,
        suffix: '%',
        icon: 'bounce',
        decimals: 1,
        trend: trend(overview.bounceRate, prevOverview?.bounceRate)
      },
      {
        title: 'Retention Rate',
        value: overview.retentionRate,
        suffix: '%',
        icon: 'retention',
        decimals: 1,
        trend: trend(overview.retentionRate, prevOverview?.retentionRate)
      },
      {
        title: 'Engagement Score',
        value: overview.engagementScore,
        icon: 'score',
        decimals: 1,
        trend: trend(overview.engagementScore, prevOverview?.engagementScore)
      }
    ];
  }, [overview, prevOverview]);

  return (
    <section className="space-y-5">
      <div className="glass-panel enter-up rounded-2xl p-5 shadow-soft">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">Analytics Dashboard</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Real-time user engagement trends and actions</p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'admin' ? (
                <button
                  type="button"
                  onClick={onGenerateDemoData}
                  disabled={seedingDemo || loadingOverview || loadingEvents}
                  className="rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-sm text-brand-700 transition hover:bg-brand-100 disabled:opacity-60 dark:border-brand-700/60 dark:bg-brand-950/40 dark:text-brand-200"
                >
                  {seedingDemo ? 'Generating...' : 'Generate Demo Analytics Data'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onRefresh}
                disabled={seedingDemo || loadingOverview || loadingEvents}
                className="rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800"
              >
                Refresh
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickRanges.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPresetChange(item.id)}
                className={`rounded-xl px-3 py-1.5 text-sm transition ${
                  preset === item.id
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                    : 'border border-slate-300 bg-white/70 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {preset === 'custom' ? (
            <DateRangeFilter startDate={range.startDate} endDate={range.endDate} onChange={setRange} />
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>
      ) : null}

      {loadingOverview ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              suffix={card.suffix}
              decimals={card.decimals || 0}
              trend={card.trend}
            />
          ))}
        </div>
      )}

      <Suspense fallback={<ChartsSkeleton />}>
        {loadingEvents ? (
          <ChartsSkeleton />
        ) : (
          <ChartsPanel eventsData={eventsData} previousEventsData={prevEventsData} />
        )}
      </Suspense>

      <Suspense fallback={<TablesSkeleton />}>
        {loadingEvents ? <TablesSkeleton /> : <TablesPanel eventsData={eventsData} />}
      </Suspense>
    </section>
  );
}

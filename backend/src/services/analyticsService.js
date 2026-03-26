import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { countUsers, listEvents, listUsers } from '../data/store.js';

function toObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function daysBetween(startDate, endDate) {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function durationBuckets(events) {
  if (!events.length) {
    return [];
  }

  const durations = [...new Set(events.map((event) => Number(event.durationMs || 0)).filter((value) => value >= 0))].sort(
    (a, b) => a - b
  );

  const min = durations[0];
  const max = durations[durations.length - 1];
  const bucketCount = Math.min(6, Math.max(1, durations.length));
  const step = Math.max(1, Math.ceil((max - min + 1) / bucketCount));

  return Array.from({ length: bucketCount }, (_, index) => {
    const start = min + index * step;
    const end = index === bucketCount - 1 ? max : start + step - 1;
    return {
      min: start,
      max: end,
      count: events.filter((event) => {
        const duration = Number(event.durationMs || 0);
        return duration >= start && duration <= end;
      }).length
    };
  }).filter((bucket) => bucket.count > 0);
}

function groupCount(items, keyFn, countLabel) {
  const grouped = new Map();

  for (const item of items) {
    const key = keyFn(item);
    if (!key) {
      continue;
    }

    grouped.set(key, (grouped.get(key) || 0) + 1);
  }

  return [...grouped.entries()]
    .map(([key, count]) => ({ key, [countLabel]: count }))
    .sort((a, b) => b[countLabel] - a[countLabel]);
}

async function getOverviewInMemory(startDate, endDate) {
  const [totalUsers, events] = await Promise.all([
    countUsers(),
    listEvents({ startDate, endDate, sort: 'desc' })
  ]);

  const activeUsers = new Set(events.filter((event) => event.userId).map((event) => String(event.userId)));
  const sessionMap = new Map();
  const pageVisitCount = new Map();

  for (const event of events) {
    const session = sessionMap.get(event.sessionId) || { durationMs: 0, eventCount: 0 };
    session.durationMs = Math.max(session.durationMs, Number(event.durationMs || 0));
    session.eventCount += 1;
    sessionMap.set(event.sessionId, session);

    if (event.eventType === 'page_visit') {
      pageVisitCount.set(event.sessionId, (pageVisitCount.get(event.sessionId) || 0) + 1);
    }
  }

  const sessions = [...sessionMap.values()];
  const avgSessionDurationMs = sessions.length
    ? sessions.reduce((sum, session) => sum + session.durationMs, 0) / sessions.length
    : 0;
  const bouncedSessions = [...pageVisitCount.values()].filter((visits) => visits === 1).length;
  const totalSessions = pageVisitCount.size || sessions.length;

  const featureTime = groupCount(
    events.filter((event) => event.feature),
    (event) => event.feature,
    'count'
  )
    .slice(0, 10)
    .map((row) => {
      const matching = events.filter((event) => event.feature === row.key);
      const avgDurationSeconds = matching.length
        ? matching.reduce((sum, event) => sum + Number(event.durationMs || 0), 0) / matching.length / 1000
        : 0;

      return {
        feature: row.key,
        avgDurationSeconds: Number(avgDurationSeconds.toFixed(2))
      };
    });

  const topUserActions = groupCount(events, (event) => event.eventType, 'count')
    .slice(0, 10)
    .map((row) => ({ eventType: row.key, count: row.count }));

  const retentionWindowStart = new Date(startDate.getTime() - 1000 * 60 * 60 * 24 * 30);
  const priorEvents = await listEvents({ startDate: retentionWindowStart, endDate: new Date(startDate.getTime() - 1) });
  const priorUsers = new Set(priorEvents.filter((event) => event.userId).map((event) => String(event.userId)));
  const retained = [...priorUsers].filter((userId) => activeUsers.has(userId)).length;
  const retentionRate = priorUsers.size ? (retained / priorUsers.size) * 100 : 0;

  const bounceRate = totalSessions ? (bouncedSessions / totalSessions) * 100 : 0;
  const engagementScoreRaw =
    (activeUsers.size * 0.35) +
    ((avgSessionDurationMs / 1000 / 60) * 0.25) +
    ((100 - bounceRate) * 0.4);

  return {
    totalUsers,
    activeUsers: activeUsers.size,
    avgSessionDurationSeconds: Number((avgSessionDurationMs / 1000).toFixed(2)),
    bounceRate: Number(bounceRate.toFixed(2)),
    retentionRate: Number(retentionRate.toFixed(2)),
    engagementScore: Math.min(100, Number(engagementScoreRaw.toFixed(2))),
    averageTimePerFeature: featureTime,
    topUserActions
  };
}

async function getUsersAnalyticsInMemory(startDate, endDate) {
  const [users, events] = await Promise.all([listUsers(), listEvents({ startDate, endDate })]);

  return users
    .map((user) => {
      const userEvents = events.filter((event) => String(event.userId || '') === String(user._id));
      const lastActivity = userEvents.reduce(
        (latest, event) =>
          !latest || event.occurredAt > latest
            ? event.occurredAt
            : latest,
        null
      );

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        eventsCount: userEvents.length,
        sessionsCount: new Set(userEvents.map((event) => event.sessionId)).size,
        lastActivity
      };
    })
    .sort((a, b) => {
      const left = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const right = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return right - left || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

async function getEventsAnalyticsInMemory(startDate, endDate, options = {}) {
  const recentLimit = options.recentLimit || 40;
  const heatmapDays = options.heatmapDays || 30;
  const heatmapStartDate = new Date(
    Math.max(startDate.getTime(), endDate.getTime() - 1000 * 60 * 60 * 24 * heatmapDays)
  );

  const events = await listEvents({ startDate, endDate, sort: 'desc' });
  const heatmapEvents = events.filter((event) => event.occurredAt >= heatmapStartDate);

  const dailyActiveUsersMap = new Map();
  for (const event of events) {
    if (!event.userId) {
      continue;
    }

    const day = event.occurredAt.toISOString().slice(0, 10);
    const users = dailyActiveUsersMap.get(day) || new Set();
    users.add(String(event.userId));
    dailyActiveUsersMap.set(day, users);
  }

  const dailyActiveUsers = [...dailyActiveUsersMap.entries()]
    .map(([date, users]) => ({ date, users: users.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sessionDurationDistribution = durationBuckets(events)
    .map((bucket) => ({
      rangeStartSec: Number((bucket.min / 1000).toFixed(2)),
      rangeEndSec: Number((bucket.max / 1000).toFixed(2)),
      count: bucket.count
    }));

  const featureUsage = groupCount(
    events.filter((event) => event.feature),
    (event) => event.feature,
    'count'
  )
    .slice(0, 12)
    .map((row) => ({ feature: row.key, count: row.count }));

  const topPages = groupCount(
    events.filter((event) => event.page),
    (event) => event.page,
    'visits'
  )
    .slice(0, 10)
    .map((row) => ({ page: row.key, visits: row.visits }));

  const mostClickedElements = groupCount(
    events.filter((event) => event.element),
    (event) => event.element,
    'clicks'
  )
    .slice(0, 10)
    .map((row) => ({ element: row.key, clicks: row.clicks }));

  const recentActivityLogs = events.slice(0, recentLimit).map((event) => ({
    occurredAt: event.occurredAt,
    eventType: event.eventType,
    page: event.page,
    feature: event.feature,
    element: event.element,
    userId: event.userId,
    sessionId: event.sessionId
  }));

  const heatmap = groupCount(
    heatmapEvents,
    (event) => `${event.occurredAt.toISOString().slice(0, 10)}|${event.occurredAt.getUTCHours()}`,
    'interactions'
  )
    .map((row) => {
      const [date, hour] = row.key.split('|');
      return {
        date,
        hour: Number(hour),
        interactions: row.interactions
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);

  return {
    dailyActiveUsers,
    sessionDurationDistribution,
    featureUsage,
    topPages,
    mostClickedElements,
    recentActivityLogs,
    engagementHeatmap: heatmap
  };
}

async function getOverview(startDate, endDate) {
  if (env.useInMemoryDb) {
    return getOverviewInMemory(startDate, endDate);
  }

  const [
    totalUsers,
    activeUsersInRange,
    sessionAgg,
    bounceAgg,
    featureTimeAgg,
    topActionsAgg
  ] = await Promise.all([
    User.countDocuments(),
    Event.distinct('userId', {
      occurredAt: { $gte: startDate, $lte: endDate },
      userId: { $ne: null }
    }),
    Event.aggregate([
      { $match: { occurredAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$sessionId',
          durationMs: { $max: '$durationMs' },
          eventCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          avgSessionDurationMs: { $avg: '$durationMs' },
          totalSessions: { $sum: 1 },
          bouncedSessions: {
            $sum: {
              $cond: [{ $lte: ['$eventCount', 1] }, 1, 0]
            }
          }
        }
      }
    ]),
    Event.aggregate([
      { $match: { occurredAt: { $gte: startDate, $lte: endDate }, eventType: 'page_visit' } },
      { $group: { _id: '$sessionId', visits: { $sum: 1 } } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          bouncedSessions: { $sum: { $cond: [{ $eq: ['$visits', 1] }, 1, 0] } }
        }
      }
    ]),
    Event.aggregate([
      {
        $match: {
          occurredAt: { $gte: startDate, $lte: endDate },
          feature: { $nin: [null, ''] }
        }
      },
      {
        $group: {
          _id: '$feature',
          avgDurationMs: { $avg: '$durationMs' }
        }
      },
      { $sort: { avgDurationMs: -1 } },
      { $limit: 10 }
    ]),
    Event.aggregate([
      { $match: { occurredAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  const sessionData = sessionAgg[0] || {
    avgSessionDurationMs: 0,
    totalSessions: 0,
    bouncedSessions: 0
  };
  const bounceData = bounceAgg[0] || {
    totalSessions: sessionData.totalSessions,
    bouncedSessions: sessionData.bouncedSessions
  };

  const retentionWindowStart = new Date(startDate.getTime() - 1000 * 60 * 60 * 24 * 30);
  const priorUsers = await Event.distinct('userId', {
    occurredAt: { $gte: retentionWindowStart, $lt: startDate },
    userId: { $ne: null }
  });
  const currentSet = new Set(activeUsersInRange.map(String));
  const retained = priorUsers.filter((u) => currentSet.has(String(u))).length;
  const retentionRate = priorUsers.length ? (retained / priorUsers.length) * 100 : 0;

  const engagementScoreRaw =
    (activeUsersInRange.length * 0.35) +
    ((sessionData.avgSessionDurationMs / 1000 / 60) * 0.25) +
    ((100 - (bounceData.totalSessions ? (bounceData.bouncedSessions / bounceData.totalSessions) * 100 : 0)) * 0.4);
  const engagementScore = Math.min(100, Number(engagementScoreRaw.toFixed(2)));

  return {
    totalUsers,
    activeUsers: activeUsersInRange.length,
    avgSessionDurationSeconds: Number((sessionData.avgSessionDurationMs / 1000).toFixed(2)),
    bounceRate: Number(
      (bounceData.totalSessions
        ? (bounceData.bouncedSessions / bounceData.totalSessions) * 100
        : 0
      ).toFixed(2)
    ),
    retentionRate: Number(retentionRate.toFixed(2)),
    engagementScore,
    averageTimePerFeature: featureTimeAgg.map((row) => ({
      feature: row._id,
      avgDurationSeconds: Number((row.avgDurationMs / 1000).toFixed(2))
    })),
    topUserActions: topActionsAgg.map((row) => ({ eventType: row._id, count: row.count }))
  };
}

async function getUsersAnalytics(startDate, endDate) {
  if (env.useInMemoryDb) {
    return getUsersAnalyticsInMemory(startDate, endDate);
  }

  const users = await User.aggregate([
    {
      $lookup: {
        from: 'events',
        let: { uid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$userId', '$$uid'] },
              occurredAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              eventsCount: { $sum: 1 },
              sessions: { $addToSet: '$sessionId' },
              lastActivity: { $max: '$occurredAt' }
            }
          }
        ],
        as: 'activity'
      }
    },
    {
      $addFields: {
        activity: { $ifNull: [{ $arrayElemAt: ['$activity', 0] }, null] }
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        role: 1,
        createdAt: 1,
        eventsCount: { $ifNull: ['$activity.eventsCount', 0] },
        sessionsCount: { $size: { $ifNull: ['$activity.sessions', []] } },
        lastActivity: '$activity.lastActivity'
      }
    },
    { $sort: { lastActivity: -1, createdAt: -1 } }
  ]);

  return users;
}

async function getEventsAnalytics(startDate, endDate, options = {}) {
  if (env.useInMemoryDb) {
    return getEventsAnalyticsInMemory(startDate, endDate, options);
  }

  const recentLimit = options.recentLimit || 40;
  const heatmapDays = options.heatmapDays || 30;
  const heatmapStartDate = new Date(
    Math.max(startDate.getTime(), endDate.getTime() - 1000 * 60 * 60 * 24 * heatmapDays)
  );

  const [dau, sessionDuration, featureUsage, topPages, topElements, recentLogs, heatmap] = await Promise.all([
    Event.aggregate([
      { $match: { occurredAt: { $gte: startDate, $lte: endDate }, userId: { $ne: null } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } },
            userId: '$userId'
          }
        }
      },
      { $group: { _id: '$_id.day', activeUsers: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Event.aggregate([
      { $match: { occurredAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$sessionId', durationMs: { $max: '$durationMs' } } },
      {
        $bucketAuto: {
          groupBy: '$durationMs',
          buckets: 6,
          output: { count: { $sum: 1 } }
        }
      }
    ]),
    Event.aggregate([
      {
        $match: {
          occurredAt: { $gte: startDate, $lte: endDate },
          feature: { $nin: [null, ''] }
        }
      },
      { $group: { _id: '$feature', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 }
    ]),
    Event.aggregate([
      { $match: { occurredAt: { $gte: startDate, $lte: endDate }, page: { $nin: [null, ''] } } },
      { $group: { _id: '$page', visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
      { $limit: 10 }
    ]),
    Event.aggregate([
      { $match: { occurredAt: { $gte: startDate, $lte: endDate }, element: { $nin: [null, ''] } } },
      { $group: { _id: '$element', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 10 }
    ]),
    Event.find({ occurredAt: { $gte: startDate, $lte: endDate } })
      .sort({ occurredAt: -1 })
      .limit(recentLimit)
      .select('occurredAt eventType page feature element userId sessionId')
      .lean(),
    Event.aggregate([
      { $match: { occurredAt: { $gte: heatmapStartDate, $lte: endDate } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } },
            hour: { $hour: '$occurredAt' }
          },
          interactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.day': 1, '_id.hour': 1 } }
    ])
  ]);

  return {
    dailyActiveUsers: dau.map((row) => ({ date: row._id, users: row.activeUsers })),
    sessionDurationDistribution: sessionDuration.map((row) => ({
      rangeStartSec: Number((row._id.min / 1000).toFixed(2)),
      rangeEndSec: Number((row._id.max / 1000).toFixed(2)),
      count: row.count
    })),
    featureUsage: featureUsage.map((row) => ({ feature: row._id, count: row.count })),
    topPages: topPages.map((row) => ({ page: row._id, visits: row.visits })),
    mostClickedElements: topElements.map((row) => ({ element: row._id, clicks: row.clicks })),
    recentActivityLogs: recentLogs,
    engagementHeatmap: heatmap.map((row) => ({
      date: row._id.day,
      hour: row._id.hour,
      interactions: row.interactions
    }))
  };
}

async function exportCsv(startDate, endDate) {
  const events = env.useInMemoryDb
    ? await listEvents({ startDate, endDate, sort: 'desc', limit: 5000 })
    : await Event.find({ occurredAt: { $gte: startDate, $lte: endDate } })
        .sort({ occurredAt: -1 })
        .limit(5000)
        .lean();

  const header = [
    'occurredAt',
    'userId',
    'sessionId',
    'eventType',
    'page',
    'feature',
    'element',
    'scrollDepth',
    'activeMs',
    'idleMs',
    'durationMs'
  ];

  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = events.map((event) =>
    [
      event.occurredAt,
      event.userId,
      event.sessionId,
      event.eventType,
      event.page,
      event.feature,
      event.element,
      event.scrollDepth,
      event.activeMs,
      event.idleMs,
      event.durationMs
    ]
      .map(escape)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
}

export const analyticsService = {
  getOverview,
  getUsersAnalytics,
  getEventsAnalytics,
  exportCsv,
  daysBetween,
  toObjectId
};

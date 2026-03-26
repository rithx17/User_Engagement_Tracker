import { createEvent } from '../data/store.js';

const ALLOWED_EVENT_TYPES = new Set([
  'page_visit',
  'page_leave',
  'session_start',
  'session_end',
  'click_event',
  'button_click',
  'scroll_depth',
  'feature_usage'
]);

function clampNumber(value, min, max, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function sanitizeText(value, { max = 160, fallback = null } = {}) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, max);
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, item]) => [String(key).slice(0, 80), typeof item === 'string' ? item.slice(0, 500) : item])
  );
}

export async function trackEvent(req, res, next) {
  try {
    const {
      eventType,
      page,
      feature,
      element,
      metadata,
      sessionId,
      scrollDepth,
      activeMs,
      idleMs,
      durationMs,
      occurredAt
    } = req.body;

    if (!eventType || !sessionId) {
      return res.status(400).json({ message: 'eventType and sessionId are required' });
    }

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return res.status(400).json({ message: 'Unsupported eventType' });
    }

    const safeOccurredAt = occurredAt ? new Date(occurredAt) : new Date();
    const resolvedOccurredAt = Number.isNaN(safeOccurredAt.getTime()) ? new Date() : safeOccurredAt;

    const userId = req.auth?.sub || null;
    const safeSessionId = sanitizeText(sessionId, { max: 120, fallback: '' });
    if (!safeSessionId) {
      return res.status(400).json({ message: 'sessionId must be a non-empty string' });
    }

    const event = await createEvent({
      userId,
      sessionId: safeSessionId,
      eventType,
      page: sanitizeText(page, { max: 240, fallback: '/' }) || '/',
      feature: sanitizeText(feature, { max: 120 }),
      element: sanitizeText(element, { max: 160 }),
      metadata: sanitizeMetadata(metadata),
      scrollDepth: clampNumber(scrollDepth, 0, 100, 0),
      activeMs: clampNumber(activeMs, 0, 1000 * 60 * 60 * 24, 0),
      idleMs: clampNumber(idleMs, 0, 1000 * 60 * 60 * 24, 0),
      durationMs: clampNumber(durationMs, 0, 1000 * 60 * 60 * 24, 0),
      occurredAt: resolvedOccurredAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({ id: event._id });
  } catch (err) {
    return next(err);
  }
}

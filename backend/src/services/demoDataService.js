import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import {
  countEvents,
  deleteEventsByUserAgent,
  insertEvents,
  upsertUserByEmail
} from '../data/store.js';

const DEMO_UA = 'auto-demo-seed';
let seedInFlight = null;

function randomPick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function createDemoUsers() {
  const usersSeed = [
    { name: 'Admin', email: 'admin@example.com', role: 'admin' },
    { name: 'Mia Chen', email: 'mia@example.com', role: 'user' },
    { name: 'Noah Shah', email: 'noah@example.com', role: 'user' },
    { name: 'Ava Patel', email: 'ava@example.com', role: 'user' }
  ];

  const users = [];
  for (const userSeed of usersSeed) {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await upsertUserByEmail(userSeed.email, {
      name: userSeed.name,
      role: userSeed.role,
      passwordHash
    });
    users.push(user);
  }

  return users;
}

async function createDemoEvents(users, { force = false } = {}) {
  if (force) {
    await deleteEventsByUserAgent(DEMO_UA);
  }

  const pages = ['/dashboard', '/pricing', '/settings', '/reports', '/features'];
  const features = ['search', 'filter', 'export_csv', 'compare_mode', 'chart_toggle'];
  const elements = ['signup_button', 'export_button', 'filter_dropdown', 'cta_banner', 'side_nav_link'];
  // Weighted distribution with required demo event types.
  const eventTypes = [
    'page_visit',
    'page_visit',
    'button_click',
    'scroll_depth',
    'click_event',
    'feature_usage'
  ];

  const start = new Date();
  start.setDate(start.getDate() - 30);

  const sessionEvents = [];
  for (const user of users) {
    const sessions = randomInt(9, 16);

    for (let s = 0; s < sessions; s += 1) {
      const sessionId = `sess_${user._id}_${s}`;
      const baseTime = new Date(start.getTime() + randomInt(0, 30 * 24 * 60 * 60 * 1000));
      const totalEvents = randomInt(8, 22);
      const durationMs = randomInt(90_000, 2_000_000);
      const sessionPage = randomPick(pages);

      sessionEvents.push({
        userId: user._id,
        sessionId,
        eventType: 'session_start',
        page: sessionPage,
        feature: null,
        element: null,
        metadata: { device: randomPick(['desktop', 'mobile', 'tablet']), plan: randomPick(['free', 'pro', 'team']) },
        scrollDepth: 0,
        activeMs: 0,
        idleMs: 0,
        durationMs: 0,
        occurredAt: new Date(baseTime.getTime() - randomInt(2_000, 9_000)),
        ip: '127.0.0.1',
        userAgent: DEMO_UA
      });

      for (let e = 0; e < totalEvents; e += 1) {
        const occurredAt = new Date(baseTime.getTime() + e * randomInt(8_000, 55_000));
        const eventType = randomPick(eventTypes);
        const page = randomPick(pages);
        const scrollDepth = randomInt(12, 100);

        sessionEvents.push({
          userId: user._id,
          sessionId,
          eventType,
          page,
          feature: eventType === 'feature_usage' ? randomPick(features) : null,
          element: eventType === 'click_event' || eventType === 'button_click' ? randomPick(elements) : null,
          metadata: {
            plan: randomPick(['free', 'pro', 'team']),
            device: randomPick(['desktop', 'mobile', 'tablet']),
            scrollDepth
          },
          scrollDepth: eventType === 'scroll_depth' || eventType === 'page_visit' ? scrollDepth : randomInt(0, 40),
          activeMs: randomInt(20_000, durationMs),
          idleMs: randomInt(0, 24_000),
          durationMs,
          occurredAt,
          ip: '127.0.0.1',
          userAgent: DEMO_UA
        });
      }

      sessionEvents.push({
        userId: user._id,
        sessionId,
        eventType: 'session_end',
        page: sessionPage,
        feature: null,
        element: null,
        metadata: { device: randomPick(['desktop', 'mobile', 'tablet']), plan: randomPick(['free', 'pro', 'team']) },
        scrollDepth: randomInt(20, 100),
        activeMs: randomInt(20_000, durationMs),
        idleMs: randomInt(0, 24_000),
        durationMs,
        occurredAt: new Date(baseTime.getTime() + durationMs),
        ip: '127.0.0.1',
        userAgent: DEMO_UA
      });
    }
  }

  if (sessionEvents.length) {
    await insertEvents(sessionEvents);
  }

  return sessionEvents.length;
}

export async function seedDemoData({ force = false } = {}) {
  const users = await createDemoUsers();
  const events = await createDemoEvents(users, { force });

  return {
    users: users.length,
    events,
    admin: { email: 'admin@example.com', password: 'password123' }
  };
}

export async function ensureDemoData() {
  if (env.nodeEnv === 'production' || !env.autoDemoSeed) {
    return;
  }

  // Always ensure demo users exist so admin access is available for demos.
  await createDemoUsers();

  const count = await countEvents();
  if (count > 0) {
    return;
  }

  if (!seedInFlight) {
    seedInFlight = seedDemoData().finally(() => {
      seedInFlight = null;
    });
  }

  await seedInFlight;
}

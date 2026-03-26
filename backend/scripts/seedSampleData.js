import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Event.js';

function randomPick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function run() {
  await mongoose.connect(env.mongoUri);

  const usersSeed = [
    { name: 'Admin', email: 'admin@example.com', role: 'admin' },
    { name: 'Mia Chen', email: 'mia@example.com', role: 'user' },
    { name: 'Noah Shah', email: 'noah@example.com', role: 'user' },
    { name: 'Ava Patel', email: 'ava@example.com', role: 'user' }
  ];

  const userDocs = [];
  for (const seed of usersSeed) {
    const passwordHash = await bcrypt.hash('password123', 12);
    const doc = await User.findOneAndUpdate(
      { email: seed.email },
      { $set: { name: seed.name, role: seed.role, passwordHash } },
      { new: true, upsert: true }
    );
    userDocs.push(doc);
  }

  const pages = ['/dashboard', '/pricing', '/settings', '/reports', '/features'];
  const features = ['search', 'filter', 'export_csv', 'compare_mode', 'chart_toggle'];
  const elements = ['signup_button', 'export_button', 'filter_dropdown', 'cta_banner', 'side_nav_link'];
  const events = ['page_visit', 'click_event', 'feature_usage'];

  const start = new Date();
  start.setDate(start.getDate() - 20);

  const sessionEvents = [];
  for (const user of userDocs) {
    const sessions = randomInt(10, 20);

    for (let s = 0; s < sessions; s += 1) {
      const sessionId = `sess_${user._id}_${s}`;
      const baseTime = new Date(start.getTime() + randomInt(0, 20 * 24 * 60 * 60 * 1000));
      const totalEvents = randomInt(6, 25);
      const durationMs = randomInt(60_000, 2_400_000);

      for (let e = 0; e < totalEvents; e += 1) {
        const occurredAt = new Date(baseTime.getTime() + e * randomInt(5_000, 60_000));
        const eventType = randomPick(events);
        sessionEvents.push({
          userId: user._id,
          sessionId,
          eventType,
          page: randomPick(pages),
          feature: eventType === 'feature_usage' ? randomPick(features) : null,
          element: eventType === 'click_event' ? randomPick(elements) : null,
          metadata: { plan: randomPick(['free', 'pro', 'team']) },
          scrollDepth: randomInt(10, 100),
          activeMs: randomInt(20_000, durationMs),
          idleMs: randomInt(0, 25_000),
          durationMs,
          occurredAt,
          ip: '127.0.0.1',
          userAgent: 'seed-script'
        });
      }
    }
  }

  await Event.deleteMany({ userAgent: 'seed-script' });
  await Event.insertMany(sessionEvents, { ordered: false });

  console.log(`Seed complete: ${userDocs.length} users, ${sessionEvents.length} events`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

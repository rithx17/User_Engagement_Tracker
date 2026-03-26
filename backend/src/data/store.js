import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Event } from '../models/Event.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../.data');
const DATA_FILE = path.join(DATA_DIR, 'dev-db.json');

let statePromise;

function createEmptyState() {
  return {
    users: [],
    events: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toId() {
  return new mongoose.Types.ObjectId().toString();
}

function serializeDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hydrateUser(user) {
  return {
    ...user,
    createdAt: user.createdAt ? new Date(user.createdAt) : null,
    updatedAt: user.updatedAt ? new Date(user.updatedAt) : null,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null
  };
}

function hydrateEvent(event) {
  return {
    ...event,
    occurredAt: event.occurredAt ? new Date(event.occurredAt) : null,
    createdAt: event.createdAt ? new Date(event.createdAt) : null,
    updatedAt: event.updatedAt ? new Date(event.updatedAt) : null
  };
}

async function ensureState() {
  if (!statePromise) {
    statePromise = (async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });

      try {
        const raw = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(raw);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }

        const initialState = createEmptyState();
        await fs.writeFile(DATA_FILE, JSON.stringify(initialState, null, 2));
        return initialState;
      }
    })();
  }

  return statePromise;
}

async function persist(nextState) {
  statePromise = Promise.resolve(nextState);
  await fs.writeFile(DATA_FILE, JSON.stringify(nextState, null, 2));
}

async function withState(mutator) {
  const currentState = await ensureState();
  const workingCopy = clone(currentState);
  const result = await mutator(workingCopy);
  await persist(workingCopy);
  return result;
}

export async function initDataStore() {
  if (env.useInMemoryDb) {
    await ensureState();
  }
}

export async function findUserByEmail(email) {
  if (!env.useInMemoryDb) {
    return User.findOne({ email });
  }

  const state = await ensureState();
  const user = state.users.find((item) => item.email === email);
  return user ? hydrateUser(user) : null;
}

export async function findUserById(id) {
  if (!env.useInMemoryDb) {
    return User.findById(id);
  }

  const state = await ensureState();
  const user = state.users.find((item) => item._id === String(id));
  return user ? hydrateUser(user) : null;
}

export async function createUser(data) {
  if (!env.useInMemoryDb) {
    return User.create(data);
  }

  return withState((state) => {
    const now = new Date().toISOString();
    const user = {
      _id: toId(),
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role || 'user',
      lastLoginAt: serializeDate(data.lastLoginAt),
      createdAt: now,
      updatedAt: now
    };

    state.users.push(user);
    return hydrateUser(user);
  });
}

export async function updateUser(userId, updates) {
  if (!env.useInMemoryDb) {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    Object.assign(user, updates);
    await user.save();
    return user;
  }

  return withState((state) => {
    const user = state.users.find((item) => item._id === String(userId));
    if (!user) {
      return null;
    }

    Object.assign(user, {
      ...updates,
      lastLoginAt: updates.lastLoginAt ? serializeDate(updates.lastLoginAt) : user.lastLoginAt,
      updatedAt: new Date().toISOString()
    });

    return hydrateUser(user);
  });
}

export async function upsertUserByEmail(email, updates) {
  if (!env.useInMemoryDb) {
    return User.findOneAndUpdate(
      { email },
      { $set: updates },
      { new: true, upsert: true }
    );
  }

  return withState((state) => {
    const now = new Date().toISOString();
    let user = state.users.find((item) => item.email === email);

    if (!user) {
      user = {
        _id: toId(),
        email,
        name: updates.name,
        role: updates.role || 'user',
        passwordHash: updates.passwordHash,
        lastLoginAt: serializeDate(updates.lastLoginAt),
        createdAt: now,
        updatedAt: now
      };
      state.users.push(user);
    } else {
      Object.assign(user, {
        ...updates,
        lastLoginAt: updates.lastLoginAt ? serializeDate(updates.lastLoginAt) : user.lastLoginAt,
        updatedAt: now
      });
    }

    return hydrateUser(user);
  });
}

export async function deleteUsersByEmail(email) {
  if (!env.useInMemoryDb) {
    const result = await User.deleteMany({ email });
    return result.deletedCount || 0;
  }

  return withState((state) => {
    const before = state.users.length;
    state.users = state.users.filter((item) => item.email !== email);
    return before - state.users.length;
  });
}

export async function listUsers() {
  if (!env.useInMemoryDb) {
    return User.find().select('_id name email role createdAt lastLoginAt').sort({ createdAt: -1 });
  }

  const state = await ensureState();
  return state.users
    .map(hydrateUser)
    .map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function countUsers() {
  if (!env.useInMemoryDb) {
    return User.countDocuments();
  }

  const state = await ensureState();
  return state.users.length;
}

export async function createEvent(data) {
  if (!env.useInMemoryDb) {
    return Event.create(data);
  }

  return withState((state) => {
    const now = new Date().toISOString();
    const event = {
      _id: toId(),
      ...data,
      occurredAt: serializeDate(data.occurredAt),
      createdAt: now,
      updatedAt: now
    };

    state.events.push(event);
    return hydrateEvent(event);
  });
}

export async function insertEvents(events) {
  if (!env.useInMemoryDb) {
    if (!events.length) {
      return [];
    }

    return Event.insertMany(events, { ordered: false });
  }

  return withState((state) => {
    const now = new Date().toISOString();
    const inserted = events.map((event) => ({
      _id: toId(),
      ...event,
      occurredAt: serializeDate(event.occurredAt),
      createdAt: now,
      updatedAt: now
    }));

    state.events.push(...inserted);
    return inserted.map(hydrateEvent);
  });
}

export async function deleteEventsByUserAgent(userAgent) {
  if (!env.useInMemoryDb) {
    const result = await Event.deleteMany({ userAgent });
    return result.deletedCount || 0;
  }

  return withState((state) => {
    const before = state.events.length;
    state.events = state.events.filter((item) => item.userAgent !== userAgent);
    return before - state.events.length;
  });
}

export async function countEvents() {
  if (!env.useInMemoryDb) {
    return Event.estimatedDocumentCount();
  }

  const state = await ensureState();
  return state.events.length;
}

export async function listEvents({ startDate, endDate, limit, sort = 'desc' } = {}) {
  if (!env.useInMemoryDb) {
    let query = Event.find({});

    if (startDate || endDate) {
      query = query.find({
        occurredAt: {
          ...(startDate ? { $gte: startDate } : {}),
          ...(endDate ? { $lte: endDate } : {})
        }
      });
    }

    query = query.sort({ occurredAt: sort === 'asc' ? 1 : -1 });
    if (limit) {
      query = query.limit(limit);
    }

    return query.lean();
  }

  const state = await ensureState();
  let events = state.events
    .map(hydrateEvent)
    .filter((event) => {
      const time = event.occurredAt?.getTime?.() || 0;
      if (startDate && time < startDate.getTime()) {
        return false;
      }
      if (endDate && time > endDate.getTime()) {
        return false;
      }
      return true;
    });

  events.sort((a, b) =>
    sort === 'asc'
      ? a.occurredAt.getTime() - b.occurredAt.getTime()
      : b.occurredAt.getTime() - a.occurredAt.getTime()
  );

  if (limit) {
    events = events.slice(0, limit);
  }

  return events;
}

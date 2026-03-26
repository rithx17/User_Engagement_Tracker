import { env } from './env.js';
import mongoose from 'mongoose';
import { initDataStore } from '../data/store.js';

export async function connectDb() {
  if (env.useInMemoryDb) {
    await initDataStore();
    return;
  }

  await mongoose.connect(env.mongoUri);
}

export async function disconnectDb() {
  if (env.useInMemoryDb) {
    return;
  }

  await mongoose.disconnect();
}

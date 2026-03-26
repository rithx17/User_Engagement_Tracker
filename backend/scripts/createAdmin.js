import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';

async function run() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: node scripts/createAdmin.js "Admin" "admin@example.com" "password123"');
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    exists.role = 'admin';
    exists.passwordHash = await bcrypt.hash(password, 12);
    await exists.save();
  } else {
    await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin'
    });
  }
  console.log('Admin user ready');
  await mongoose.disconnect();
}

run();

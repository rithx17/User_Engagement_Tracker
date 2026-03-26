import { connectDb, disconnectDb } from '../src/config/db.js';
import { seedDemoData } from '../src/services/demoDataService.js';

async function run() {
  await connectDb();
  const result = await seedDemoData({ force: true });
  console.log(`Analytics seed complete: ${result.users} users, ${result.events} events`);
  console.log(`Demo admin: ${result.admin.email} / ${result.admin.password}`);
  await disconnectDb();
}

run().catch(async (err) => {
  console.error('Failed to seed analytics data', err);
  await disconnectDb();
  process.exit(1);
});

import { app } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { ensureDemoData } from './services/demoDataService.js';

async function start() {
  try {
    await connectDb();
    await ensureDemoData();
    app.listen(env.port, env.host, () => {
      console.log(`Backend listening on http://${env.host}:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

start();

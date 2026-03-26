import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { seedDemoData } from '../services/demoDataService.js';
import { createUser, deleteUsersByEmail } from '../data/store.js';

const router = Router();

router.post('/seed', async (req, res, next) => {
  try {
    const seeded = await seedDemoData({ force: true });

    res.json({
      message: 'Seeded',
      ...seeded
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-admin', async (req, res, next) => {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    await deleteUsersByEmail('admin@example.com');
    const admin = await createUser({
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      passwordHash
    });

    res.json({
      message: 'Admin reset complete',
      admin: { id: admin._id, email: admin.email, role: admin.role }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

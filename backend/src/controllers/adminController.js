import { listUsers as listAllUsers } from '../data/store.js';

export async function listUsers(req, res, next) {
  try {
    const users = await listAllUsers();
    return res.json({ data: users });
  } catch (err) {
    return next(err);
  }
}

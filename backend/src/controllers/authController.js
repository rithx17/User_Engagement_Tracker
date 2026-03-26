import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { createUser, findUserByEmail, findUserById, updateUser } from '../data/store.js';

function tokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function register(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const email = sanitizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }

    if (name.length < 2 || name.length > 120) {
      return res.status(400).json({ message: 'Name must be between 2 and 120 characters' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const exists = await findUserByEmail(email);
    if (exists) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      name,
      email,
      passwordHash
    });

    const token = signToken(user);
    tokenCookie(res, token);

    return res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const updatedUser = await updateUser(user._id, { lastLoginAt: new Date() });

    const token = signToken(updatedUser || user);
    tokenCookie(res, token);

    return res.json({
      user: {
        id: (updatedUser || user)._id,
        name: (updatedUser || user).name,
        email: (updatedUser || user).email,
        role: (updatedUser || user).role
      },
      token
    });
  } catch (err) {
    return next(err);
  }
}

export async function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure
  });
  return res.json({ message: 'Logged out' });
}

export async function me(req, res, next) {
  try {
    const user = await findUserById(req.auth.sub);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }
    });
  } catch (err) {
    return next(err);
  }
}

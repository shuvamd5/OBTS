import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import { AppError, asyncHandler } from './errorHandler.js';

export const signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.ustatus }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });

export const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

export const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookie.secure,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'Not authenticated');
  }
  const token = header.slice('Bearer '.length);
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.accessSecret);
  } catch {
    throw new AppError(401, 'Invalid or expired access token');
  }
  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError(401, 'Account no longer exists');
  }
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.ustatus)) {
    return next(new AppError(403, 'Insufficient permissions'));
  }
  next();
};
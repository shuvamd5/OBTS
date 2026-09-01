import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { signAccessToken, signRefreshToken, refreshCookieOptions } from '../middleware/auth.js';

const todayParts = () => {
  const d = new Date();
  return {
    udate: d,
    utime: d.toTimeString().slice(0, 8),
  };
};

export const register = asyncHandler(async (req, res) => {
  const { uname, uemail, umobile, upass, ugender } = req.body;

  const existing = await User.findOne({
    $or: [{ uemail: uemail.toLowerCase() }, { umobile }],
  });
  if (existing) {
    throw new AppError(409, 'The email/mobile has already been registered');
  }

  const passwordHash = await bcrypt.hash(upass, 10);
  const { udate, utime } = todayParts();

  const user = await User.create({
    uname,
    uemail: uemail.toLowerCase(),
    umobile,
    ugender,
    passwordHash,
    ustatus: 'User',
    udate,
    utime,
    totaltc: 0,
    reservedtc: 0,
    pendingtc: 0,
    payment: 0,
    due: 0,
    points: 0,
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.cookie(config.cookie.name, refreshToken, refreshCookieOptions);

  res.status(201).json({ message: 'Registration complete', accessToken, user: user.toSafeJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { logid, logpass } = req.body;

  const user = await User.findOne({
    $or: [{ uemail: logid.toLowerCase() }, { umobile: logid }],
  }).select('+passwordHash');

  if (!user || !(await user.comparePassword(logpass))) {
    throw new AppError(401, 'Login failed. Check your credentials.');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.cookie(config.cookie.name, refreshToken, refreshCookieOptions);

  res.json({ message: 'Login successful', accessToken, user: user.toSafeJSON() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[config.cookie.name];
  if (!token) {
    throw new AppError(401, 'No refresh token');
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.refreshSecret);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }
  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError(401, 'Account no longer exists');
  }
  const accessToken = signAccessToken(user);
  res.json({ accessToken, user: user.toSafeJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(config.cookie.name, { path: '/api/auth' });
  res.json({ message: 'Logged out' });
});
import crypto from 'crypto';
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
  const { uname, uemail, umobile, upass, ugender } = req.validated.body;

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
    ustatus: 'customer',
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
  const { logid, logpass } = req.validated.body;

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

export const updateMe = asyncHandler(async (req, res) => {
  const { uname, uemail, umobile, ugender, curpass, upass } = req.validated.body;
  const changed =
    uname !== undefined ||
    uemail !== undefined ||
    umobile !== undefined ||
    ugender !== undefined ||
    upass !== undefined;
  if (!changed) {
    throw new AppError(400, 'Nothing to update');
  }

  const me = await User.findById(req.user._id).select('+passwordHash');

  const or = [];
  if (uemail) or.push({ uemail: uemail.toLowerCase() });
  if (umobile) or.push({ umobile });
  if (or.length) {
    const dup = await User.findOne({ _id: { $ne: me._id }, $or: or });
    if (dup) {
      throw new AppError(409, 'The email/mobile has already been registered');
    }
  }

  if (upass) {
    if (curpass === undefined || !(await me.comparePassword(curpass))) {
      throw new AppError(401, 'Current password is incorrect');
    }
    me.passwordHash = await bcrypt.hash(upass, 10);
  }

  if (uname !== undefined) me.uname = uname;
  if (uemail !== undefined) me.uemail = uemail.toLowerCase();
  if (umobile !== undefined) me.umobile = umobile;
  if (ugender !== undefined) me.ugender = ugender;

  await me.save();
  res.json({ message: 'Profile updated', user: me.toSafeJSON() });
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

export const forgotPassword = asyncHandler(async (req, res) => {
  const { uemail } = req.validated.body;

  const user = await User.findOne({ uemail: uemail.toLowerCase() });
  if (!user) {
    throw new AppError(404, 'No account found with that email');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.resetTokenExpiry = Date.now() + 60 * 60 * 1000;
  await user.save();

  const resetUrl = `${config.clientOrigin}/reset-password/${rawToken}`;
  console.log('\n[FORGOT-PASSWORD] Reset link for', user.uemail, ':', resetUrl, '\n');

  res.json({ message: 'If the email exists, a reset link has been sent' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { upass } = req.validated.body;

  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetToken: hashed,
    resetTokenExpiry: { $gt: new Date() },
  }).select('+passwordHash +resetToken');

  if (!user) {
    throw new AppError(400, 'Reset link is invalid or has expired');
  }

  user.passwordHash = await bcrypt.hash(upass, 10);
  user.resetToken = null;
  user.resetTokenExpiry = null;
  await user.save();

  res.json({ message: 'Password has been reset. You can now log in.' });
});
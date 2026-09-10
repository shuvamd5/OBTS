import User from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

export const listUsers = asyncHandler(async (req, res) => {
  const isOperator = req.user.ustatus === 'operator';
  const isAdmin = req.user.ustatus === 'admin';

  const filter = {};
  if (isOperator) {
    filter.ustatus = 'customer';
  } else if (isAdmin && req.validated.query.role) {
    filter.ustatus = req.validated.query.role;
  }

  const users = await User.find(filter).sort({ uname: 1 }).lean();
  res.json({ users: users.map((u) => ({ ...u, passwordHash: undefined })) });
});

export const getUser = asyncHandler(async (req, res) => {
  const viewerIsStaff = ['admin', 'operator'].includes(req.user.ustatus);
  if (!viewerIsStaff && req.validated.params.id !== req.user._id.toString()) {
    throw new AppError(403, 'Insufficient permissions');
  }
  const user = await User.findById(req.validated.params.id);
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  res.json({ user: user.toSafeJSON() });
});

export const updateRole = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { ustatus } = req.validated.body;

  const target = await User.findById(id);
  if (!target) {
    throw new AppError(404, 'User not found');
  }

  if (target.ustatus === ustatus) {
    return res.json({ user: target.toSafeJSON(), message: 'No change' });
  }

  target.ustatus = ustatus;
  await target.save();

  res.json({ user: target.toSafeJSON(), message: 'Role updated' });
});
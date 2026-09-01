import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const USER_ROLES = ['Admin', 'Manager', 'User'];

const userSchema = new mongoose.Schema(
  {
    uname: { type: String, required: true, maxlength: 25 },
    passwordHash: { type: String, required: true, select: false },
    ugender: { type: String, enum: ['Female', 'Male', 'Other'], required: true },
    uemail: { type: String, required: true, unique: true, lowercase: true },
    umobile: { type: String, required: true, unique: true },
    ustatus: { type: String, enum: USER_ROLES, default: 'User' },
    udate: { type: Date, default: () => new Date() },
    utime: { type: String, default: () => new Date().toTimeString().slice(0, 8) },
    totaltc: { type: Number, default: 0 },
    reservedtc: { type: Number, default: 0 },
    pendingtc: { type: Number, default: 0 },
    payment: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const { passwordHash: _passwordHash, __v, ...safe } = this.toObject();
  return safe;
};

const User = mongoose.model('User', userSchema);

export default User;
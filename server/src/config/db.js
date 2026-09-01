import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB() {
  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB error:', err.message);
  });
  await mongoose.connect(config.mongoUri);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
import mongoose from 'mongoose';
import { config } from './env.js';
import { backfillIndexes } from '../utils/backfillIndexes.js';
import { backfillRouteFields } from '../utils/backfillRouteFields.js';
import { backfillRouteDuration } from '../utils/backfillRouteDuration.js';
import { backfillScheduleStatuses } from '../utils/backfillScheduleStatuses.js';
import { backfillPaymentStatus, backfillPaidPayments } from '../utils/backfillPaymentStatus.js';

export async function connectDB() {
  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB error:', err.message);
  });
  // autoIndex is off here so the legacy full-unique indexes can be replaced by
  // the partial unique indexes (see backfillIndexes) before schema-index build.
  await mongoose.connect(config.mongoUri, { autoIndex: false });
  await backfillIndexes();
  await backfillRouteFields();
  await backfillRouteDuration();
  await backfillScheduleStatuses();
  await backfillPaymentStatus();
  await backfillPaidPayments();
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
import mongoose from 'mongoose';

const UNAVAILABLE_MESSAGES = [
  'Transaction numbers are only allowed on a replica set member or mongos',
  'Transaction numbers are not allowed on a standalone server',
  'Transaction numbers are not supported',
  'is not supported against a standalone server',
];

const isUnavailable = (err) =>
  Boolean(err) &&
  (err.code === 20 ||
    UNAVAILABLE_MESSAGES.some((m) => String(err.message ?? '').includes(m)));


export async function runInTransaction(work) {
  const session = await mongoose.startSession();
  let sessionActive = false;
  try {
    session.startTransaction();
    sessionActive = true;
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (!isUnavailable(err)) {
      if (sessionActive) await session.abortTransaction().catch(() => {});
      throw err;
    }
    if (sessionActive) await session.abortTransaction().catch(() => {});
    return work(null);
  } finally {
    await session.endSession().catch(() => {});
  }
}
import '../src/config/env.js';
import mongoose from 'mongoose';
import Referral from '../src/models/Referral.js';
import User from '../src/models/User.js';
import UserTransaction from '../src/models/UserTransaction.js';

try {
  await mongoose.connect(process.env.MONGO_URI);
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') {
    throw new Error('Referral rewards require a MongoDB replica set or sharded cluster for transactions.');
  }
  await Referral.createIndexes();
  await User.collection.createIndex({ referralRecoveryPending: 1, updatedAt: 1 });
  await UserTransaction.createIndexes();
  const recovery = await User.updateMany({ referredBy: { $ne: null } }, { $set: { referralRecoveryPending: true } });
  console.log('[REFERRAL_MIGRATION_READY]', { recoveryUsers: recovery.modifiedCount });
} catch (error) {
  console.error('[REFERRAL_MIGRATION_FAILED]', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

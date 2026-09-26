import '../src/config/env.js';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

export const runMigration = async () => {
  const filter = {
    $or: [
      { isRegistrationComplete: { $exists: false } },
      { isRegistrationComplete: null }
    ]
  };

  const count = await User.countDocuments(filter);
  console.log(`[MIGRATION_AUDIT] Found ${count} legacy users missing isRegistrationComplete field.`);

  if (count > 0) {
    const result = await User.updateMany(filter, {
      $set: { isRegistrationComplete: true }
    });
    console.log(`[MIGRATION_SUCCESS] Updated ${result.modifiedCount} legacy users to isRegistrationComplete: true.`);
    return { count, updated: result.modifiedCount };
  } else {
    console.log('[MIGRATION_NOOP] All users already have isRegistrationComplete field explicitly configured.');
    return { count: 0, updated: 0 };
  }
};

// If invoked directly from CLI
if (process.argv[1] && process.argv[1].endsWith('migrate-registration-flag.mjs')) {
  (async () => {
    try {
      if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not defined in environment');
      }
      await mongoose.connect(process.env.MONGO_URI);
      await runMigration();
    } catch (err) {
      console.error('[MIGRATION_FAILED]', err.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect().catch(() => {});
    }
  })();
}

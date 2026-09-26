import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../src/models/User.js';
import {
  validateUserOtpRequestPayload,
  validateUserOtpVerifyPayload,
  validateCompleteRegistrationPayload
} from '../src/middleware/requestValidation.js';
import { requireRegistrationComplete } from '../src/middleware/authMiddleware.js';

test('AUTH SCHEMA: User model has isRegistrationComplete boolean field defaulting to false', () => {
  const regPath = User.schema.path('isRegistrationComplete');
  assert.ok(regPath, 'User schema must have isRegistrationComplete field');
  assert.equal(regPath.instance, 'Boolean');
  assert.equal(regPath.defaultValue, false);

  const testUser = new User({ phone: '9999999999' });
  assert.equal(testUser.isRegistrationComplete, false);
});

test('AUTH VALIDATION: request-otp accepts phone without requiring type', () => {
  let nextCalled = false;
  const req = {
    body: {
      phone: '9876543210'
    }
  };
  const res = {
    status: (code) => ({
      json: (data) => {
        throw new Error(`Should not send error: ${code} ${JSON.stringify(data)}`);
      }
    })
  };
  validateUserOtpRequestPayload(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.body.phone, '9876543210');
  assert.equal(req.body.type, undefined);
});

test('AUTH VALIDATION: request-otp maintains backward compatibility when type is passed', () => {
  let nextCalled = false;
  const req = {
    body: {
      phone: '9876543210',
      type: 'login'
    }
  };
  const res = {};
  validateUserOtpRequestPayload(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.body.phone, '9876543210');
  assert.equal(req.body.type, 'login');
});

test('AUTH VALIDATION: request-otp rejects invalid phone length', () => {
  let statusCode = null;
  let responseData = null;
  const req = {
    body: {
      phone: '12345'
    }
  };
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };
  validateUserOtpRequestPayload(req, res, () => {});
  assert.equal(statusCode, 400);
  assert.ok(responseData.message.includes('10-digit'));
});

test('AUTH VALIDATION: complete-registration rejects missing or invalid name', () => {
  // 1. Missing name
  let statusCode = null;
  let responseData = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  validateCompleteRegistrationPayload({ body: {} }, res, () => {});
  assert.equal(statusCode, 400);
  assert.ok(responseData.message.includes('Full name is required'));

  // 2. Name too short
  validateCompleteRegistrationPayload({ body: { name: 'A' } }, res, () => {});
  assert.equal(statusCode, 400);
  assert.ok(responseData.message.includes('between 2 and 60'));

  // 3. Name with invalid characters
  validateCompleteRegistrationPayload({ body: { name: 'Amit123!' } }, res, () => {});
  assert.equal(statusCode, 400);
  assert.ok(responseData.message.includes('letters and spaces'));
});

test('AUTH VALIDATION: complete-registration validates optional email', () => {
  let statusCode = null;
  let responseData = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  // Invalid email format
  validateCompleteRegistrationPayload({ body: { name: 'Amit Kumar', email: 'not-an-email' } }, res, () => {});
  assert.equal(statusCode, 400);
  assert.ok(responseData.message.includes('valid email address'));

  // Valid email format
  let nextCalled = false;
  const req = { body: { name: 'Amit Kumar', email: 'amit@example.com' } };
  validateCompleteRegistrationPayload(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.body.name, 'Amit Kumar');
  assert.equal(req.body.email, 'amit@example.com');
});

test('AUTH MIDDLEWARE: requireRegistrationComplete blocks incomplete accounts (isRegistrationComplete: false)', () => {
  let statusCode = null;
  let responseData = null;
  const req = {
    user: {
      _id: 'user123',
      phone: '9876543210',
      isRegistrationComplete: false
    }
  };
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  requireRegistrationComplete(req, res, () => {});
  assert.equal(statusCode, 403);
  assert.equal(responseData.requiresRegistration, true);
  assert.ok(responseData.message.includes('complete your registration'));
});

test('AUTH MIDDLEWARE: requireRegistrationComplete permits completed accounts (isRegistrationComplete: true)', () => {
  let nextCalled = false;
  const req = {
    user: {
      _id: 'user123',
      phone: '9876543210',
      isRegistrationComplete: true
    }
  };
  const res = {};

  requireRegistrationComplete(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('AUTH MIDDLEWARE: requireRegistrationComplete permits legacy accounts (isRegistrationComplete: undefined)', () => {
  let nextCalled = false;
  const req = {
    user: {
      _id: 'user123',
      phone: '9876543210'
      // isRegistrationComplete is undefined
    }
  };
  const res = {};

  requireRegistrationComplete(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('AUTH MIDDLEWARE: requireRegistrationComplete permits Mongoose hydrated legacy docs missing field on disk', () => {
  let nextCalled = false;
  // Simulating an un-migrated document returned from MongoDB before isRegistrationComplete existed
  const legacyHydratedUser = User.hydrate({
    _id: '507f1f77bcf86cd799439011',
    name: 'Old Customer',
    phone: '9876543210'
  });

  const req = { user: legacyHydratedUser };
  const res = {
    status: (code) => ({
      json: (data) => {
        throw new Error(`Should not block legacy user: ${code} ${JSON.stringify(data)}`);
      }
    })
  };

  requireRegistrationComplete(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});


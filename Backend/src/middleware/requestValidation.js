import { sendError } from '../utils/apiResponse.js';

const normalizePhoneTo10 = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return digits;
};

const normalizeOtp = (value) => String(value ?? '').replace(/\D/g, '');

export const validateUserOtpRequestPayload = (req, res, next) => {
  const phone = normalizePhoneTo10(req.body?.phone);
  const typeRaw = req.body?.type;
  const type = typeof typeRaw === 'string' ? typeRaw.trim().toLowerCase() : undefined;

  if (!phone || phone.length !== 10) {
    return sendError(req, res, 400, 'Please provide a valid 10-digit phone number');
  }

  if (type && !['login', 'register'].includes(type)) {
    return sendError(req, res, 400, 'Invalid request type');
  }

  req.body.phone = phone;
  if (type) req.body.type = type;
  next();
};

export const validateUserOtpVerifyPayload = (req, res, next) => {
  const phone = normalizePhoneTo10(req.body?.phone);
  const otp = normalizeOtp(req.body?.otp);

  if (!phone || phone.length !== 10) {
    return sendError(req, res, 400, 'Please provide a valid 10-digit phone number');
  }

  if (!otp || otp.length < 4 || otp.length > 8) {
    return sendError(req, res, 400, 'Please provide a valid OTP');
  }

  if (typeof req.body?.name === 'string') {
    req.body.name = req.body.name.trim().slice(0, 80);
  }

  if (typeof req.body?.email === 'string') {
    req.body.email = req.body.email.trim().toLowerCase().slice(0, 120);
  }

  req.body.phone = phone;
  req.body.otp = otp;
  next();
};

export const validateUserOtpResendPayload = (req, res, next) => {
  const phone = normalizePhoneTo10(req.body?.phone);
  if (!phone || phone.length !== 10) {
    return sendError(req, res, 400, 'Please provide a valid 10-digit phone number');
  }

  req.body.phone = phone;
  next();
};

export const validateDeliveryOtpRequestPayload = (req, res, next) => {
  const phone = normalizePhoneTo10(req.body?.phone);
  if (!phone || phone.length !== 10) {
    return sendError(req, res, 400, 'Please provide a valid 10-digit phone number');
  }

  req.body.phone = phone;
  next();
};

export const validateDeliveryOtpVerifyPayload = (req, res, next) => {
  const phone = normalizePhoneTo10(req.body?.phone);
  const otp = normalizeOtp(req.body?.otp);

  if (!phone || phone.length !== 10) {
    return sendError(req, res, 400, 'Please provide a valid 10-digit phone number');
  }

  if (!otp || otp.length < 4 || otp.length > 8) {
    return sendError(req, res, 400, 'Please provide a valid OTP');
  }

  req.body.phone = phone;
  req.body.otp = otp;
  next();
};

export const validateFcmUpdatePayload = (req, res, next) => {
  const tokenRaw = req.body?.fcmToken;
  const platformRaw = req.body?.platform;
  const fcmToken = typeof tokenRaw === 'string' ? tokenRaw.trim() : '';
  const platform = typeof platformRaw === 'string' ? platformRaw.trim().toLowerCase() : undefined;

  if (!fcmToken || fcmToken.length < 20) {
    return sendError(req, res, 400, 'Valid FCM token is required');
  }

  if (platform && !['app', 'web'].includes(platform)) {
    return sendError(req, res, 400, 'Invalid platform value');
  }

  req.body.fcmToken = fcmToken;
  if (platform) req.body.platform = platform;
  next();
};

export const validateCompleteRegistrationPayload = (req, res, next) => {
  const nameRaw = req.body?.name;
  const emailRaw = req.body?.email;

  if (!nameRaw || typeof nameRaw !== 'string' || !nameRaw.trim()) {
    return sendError(req, res, 400, 'Full name is required');
  }

  const trimmedName = nameRaw.trim();
  if (trimmedName.length < 2 || trimmedName.length > 60) {
    return sendError(req, res, 400, 'Full name must be between 2 and 60 characters');
  }

  const nameRegex = /^[a-zA-Z\s]+$/;
  if (!nameRegex.test(trimmedName)) {
    return sendError(req, res, 400, 'Full name should only contain letters and spaces, without numbers or special characters');
  }

  let trimmedEmail = undefined;
  if (emailRaw && typeof emailRaw === 'string' && emailRaw.trim()) {
    trimmedEmail = emailRaw.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return sendError(req, res, 400, 'Please provide a valid email address');
    }
  }

  req.body.name = trimmedName;
  if (trimmedEmail) {
    req.body.email = trimmedEmail;
  } else {
    delete req.body.email;
  }

  next();
};


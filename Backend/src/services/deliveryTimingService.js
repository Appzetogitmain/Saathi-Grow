import DeliverySlot from '../models/DeliverySlot.js';
import GlobalSetting from '../models/GlobalSetting.js';
import mongoose from 'mongoose';

export const DEFAULT_DELIVERY_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_SLOT_CUTOFF_MINUTES = 30;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const parseTimeToMinutes = (value) => {
  const match = TIME_PATTERN.exec(String(value || ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const getZonedDateParts = (date = new Date(), timeZone = DEFAULT_DELIVERY_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
};

export const isSlotBookable = (slot, settings = {}, now = new Date()) => {
  if (!slot?.isActive) return false;
  const startMinutes = parseTimeToMinutes(slot.startTime);
  if (startMinutes === null) return false;
  const configuredCutoff = settings.slotBookingCutoffMinutes ?? DEFAULT_SLOT_CUTOFF_MINUTES;
  const cutoff = Math.max(0, Number(configuredCutoff));
  const { minutes } = getZonedDateParts(now, settings.deliveryTimezone || DEFAULT_DELIVERY_TIMEZONE);
  return startMinutes - minutes > cutoff;
};

export const getDeliverySettings = async () => {
  let settings = await GlobalSetting.findOne();
  if (!settings) settings = await GlobalSetting.create({});
  return settings;
};

/**
 * Phase 8: Multi-Day Delivery Availability Engine
 * Computes availability across upcoming dates taking into account:
 * timezone, cutoff minutes, active slots, capacity per date, and admin holidays.
 */
export const getAvailableDays = async (daysToLookAhead = 5, now = new Date()) => {
  const [slots, settings] = await Promise.all([
    DeliverySlot.find({ isActive: true }).sort({ startTime: 1 }).lean(),
    getDeliverySettings()
  ]);

  const timezone = settings.deliveryTimezone || DEFAULT_DELIVERY_TIMEZONE;
  const holidays = Array.isArray(settings.holidays) ? settings.holidays : [];
  const { date: todayDateStr } = getZonedDateParts(now, timezone);

  const [y, m, d] = todayDateStr.split('-').map(Number);
  const baseUtcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const Order = mongoose.model('Order');
  const days = [];
  const totalDaysToScan = Math.max(3, Math.min(14, Number(daysToLookAhead) || 5));

  for (let i = 0; i < totalDaysToScan; i++) {
    const currentStepDate = new Date(baseUtcNoon.getTime() + i * 86400000);
    const { date: dateStr } = getZonedDateParts(currentStepDate, timezone);

    const isToday = i === 0;
    const isTomorrow = i === 1;

    const dayName = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: timezone }).format(currentStepDate);
    const fullDayName = new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: timezone }).format(currentStepDate);
    const dateLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: timezone }).format(currentStepDate);

    let displayLabel = `${dayName}, ${dateLabel}`;
    if (isToday) displayLabel = `Today, ${dateLabel}`;
    else if (isTomorrow) displayLabel = `Tomorrow, ${dateLabel}`;

    const holiday = holidays.find(h => h.date === dateStr);

    if (holiday) {
      days.push({
        date: dateStr,
        displayLabel,
        dateLabel,
        dayName,
        fullDayName,
        isToday,
        isTomorrow,
        isHoliday: true,
        holidayName: holiday.name || 'Shop Holiday',
        holidayReason: holiday.reason || '',
        isAvailable: false,
        unavailableReason: `Holiday — ${holiday.name || 'Shop Closed'}`,
        slots: []
      });
      continue;
    }

    const candidateSlots = isToday
      ? slots.filter(slot => isSlotBookable(slot, settings, now))
      : slots;

    const availableSlots = [];
    for (const slot of candidateSlots) {
      const max = slot.maxOrders || 50;
      const bookedCount = await Order.countDocuments({
        deliverySlotId: slot._id,
        'deliveryWindowSnapshot.scheduledDate': dateStr,
        status: { $nin: ['cancelled', 'returned'] }
      });
      if (bookedCount < max) {
        availableSlots.push({
          _id: slot._id,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxOrders: max,
          availableCapacity: max - bookedCount
        });
      }
    }

    const isAvailable = availableSlots.length > 0;
    days.push({
      date: dateStr,
      displayLabel,
      dateLabel,
      dayName,
      fullDayName,
      isToday,
      isTomorrow,
      isHoliday: false,
      holidayName: null,
      holidayReason: null,
      isAvailable,
      unavailableReason: isAvailable ? null : (isToday ? 'All slots for today have passed' : 'All slots are fully booked'),
      slots: availableSlots
    });
  }

  const todayIsHoliday = Boolean(holidays.find(h => h.date === todayDateStr));

  return {
    timezone,
    todayDate: todayDateStr,
    immediateDelivery: {
      enabled: Boolean(settings.immediateDeliveryEnabled && !todayIsHoliday),
      fee: Number(settings.immediateDeliveryFee) || 0,
      unavailableReason: todayIsHoliday ? 'Immediate delivery closed today for holiday' : (!settings.immediateDeliveryEnabled ? 'Immediate delivery disabled' : null)
    },
    days
  };
};

export const validateAndBuildDeliveryTiming = async (deliverySlotId, requestedImmediate, requestedDate = null, now = new Date()) => {
  const settings = await getDeliverySettings();
  const timezone = settings.deliveryTimezone || DEFAULT_DELIVERY_TIMEZONE;
  const todayDateStr = getZonedDateParts(now, timezone).date;

  // Backward compatibility: handle if 3rd param is a Date object (legacy tests)
  let targetDate = todayDateStr;
  let effectiveNow = now;
  if (requestedDate instanceof Date) {
    effectiveNow = requestedDate;
    targetDate = getZonedDateParts(effectiveNow, timezone).date;
  } else if (typeof requestedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate.trim())) {
    targetDate = requestedDate.trim();
  }

  const holidays = Array.isArray(settings.holidays) ? settings.holidays : [];
  const holiday = holidays.find(h => h.date === targetDate);

  // Preserve compatibility with older clients that omitted the flag for ASAP orders.
  const isImmediate = requestedImmediate === true || (requestedImmediate == null && !deliverySlotId);

  if (isImmediate) {
    if (holiday) {
      throw new Error(`Immediate delivery is unavailable today (${holiday.name || 'Shop Holiday'}).`);
    }
    if (!settings.immediateDeliveryEnabled) {
      throw new Error('Immediate delivery is currently unavailable. Please select a delivery slot.');
    }
    return {
      deliverySlot: 'Immediate Delivery', deliverySlotId: null, isImmediate: true,
      deliveryWindowSnapshot: { label: 'Immediate Delivery', startTime: null, endTime: null, timezone, scheduledDate: todayDateStr, isImmediate: true }
    };
  }

  if (holiday) {
    throw new Error(`Delivery is unavailable on ${targetDate} due to a scheduled holiday (${holiday.name}).`);
  }

  if (targetDate < todayDateStr) {
    throw new Error('Selected delivery date cannot be in the past.');
  }

  if (!deliverySlotId) throw new Error('Please select a delivery slot.');
  const slot = await DeliverySlot.findById(deliverySlotId);
  if (!slot || !slot.isActive) {
    throw new Error('The selected delivery slot is unavailable. Please select another slot.');
  }

  // If target date is today, verify slot time cutoff has not passed
  if (targetDate === todayDateStr && !isSlotBookable(slot, settings, effectiveNow)) {
    throw new Error('The selected delivery slot is unavailable or has already passed. Please select another slot.');
  }

  const Order = mongoose.model('Order');
  const existingOrders = await Order.countDocuments({
    deliverySlotId: slot._id,
    'deliveryWindowSnapshot.scheduledDate': targetDate,
    status: { $nin: ['cancelled', 'returned'] }
  });
  if (existingOrders >= (slot.maxOrders || 50)) {
    throw new Error('The selected delivery slot is full. Please select another slot.');
  }

  return {
    deliverySlot: slot.label, deliverySlotId: slot._id, isImmediate: false,
    deliveryWindowSnapshot: { label: slot.label, startTime: slot.startTime, endTime: slot.endTime, timezone, scheduledDate: targetDate, isImmediate: false }
  };
};

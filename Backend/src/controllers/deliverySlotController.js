import DeliverySlot from '../models/DeliverySlot.js';
import Order from '../models/Order.js';
import { getDeliverySettings, getZonedDateParts, isSlotBookable, parseTimeToMinutes, getAvailableDays } from '../services/deliveryTimingService.js';

const validateSlotInput = ({ startTime, endTime, label, maxOrders }) => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) throw new Error('Start and end time must use HH:mm format.');
  if (start >= end) throw new Error('End time must be later than start time.');
  if (!String(label || '').trim()) throw new Error('Slot label is required.');
  const limit = Number(maxOrders ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Max orders must be between 1 and 1000.');
  return limit;
};

// @desc    Get all delivery slots
// @route   GET /api/delivery-slots
// @access  Public
export const getDeliverySlots = async (req, res) => {
  try {
    const [slots, settings] = await Promise.all([
      DeliverySlot.find({ isActive: true }).sort({ startTime: 1 }),
      getDeliverySettings()
    ]);
    const scheduledDate = getZonedDateParts(new Date(), settings.deliveryTimezone).date;
    const bookableSlots = slots.filter((slot) => isSlotBookable(slot, settings));
    const slotsWithCapacity = await Promise.all(bookableSlots.map(async (slot) => {
      const orderCount = await Order.countDocuments({
        deliverySlotId: slot._id,
        'deliveryWindowSnapshot.scheduledDate': scheduledDate,
        status: { $nin: ['cancelled', 'returned'] }
      });
      return orderCount < (slot.maxOrders || 50) ? slot : null;
    }));
    res.json(slotsWithCapacity.filter(Boolean));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all delivery slots (Admin)
// @route   GET /api/admin/delivery-slots
// @access  Private (Admin)
export const getAllSlotsAdmin = async (req, res) => {
  try {
    const slots = await DeliverySlot.find().sort({ startTime: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a delivery slot
// @route   POST /api/admin/delivery-slots
// @access  Private (Admin)
export const createDeliverySlot = async (req, res) => {
  try {
    const { startTime, endTime, label, isActive } = req.body;
    const maxOrders = validateSlotInput(req.body);
    const slot = await DeliverySlot.create({
      startTime,
      endTime,
      label,
      isActive,
      maxOrders
    });
    res.status(201).json(slot);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a delivery slot
// @route   PUT /api/admin/delivery-slots/:id
// @access  Private (Admin)
export const updateDeliverySlot = async (req, res) => {
  try {
    const slot = await DeliverySlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ message: 'Slot not found' });

    const nextValues = {
      startTime: req.body.startTime ?? slot.startTime,
      endTime: req.body.endTime ?? slot.endTime,
      label: req.body.label ?? slot.label,
      maxOrders: req.body.maxOrders ?? slot.maxOrders
    };
    const maxOrders = validateSlotInput(nextValues);
    slot.startTime = nextValues.startTime;
    slot.endTime = nextValues.endTime;
    slot.label = String(nextValues.label).trim();
    slot.maxOrders = maxOrders;
    slot.isActive = req.body.isActive !== undefined ? req.body.isActive : slot.isActive;

    const updatedSlot = await slot.save();
    res.json(updatedSlot);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a delivery slot
// @route   DELETE /api/admin/delivery-slots/:id
// @access  Private (Admin)
export const deleteDeliverySlot = async (req, res) => {
  try {
    const slot = await DeliverySlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ message: 'Slot not found' });

    await slot.deleteOne();
    res.json({ message: 'Slot removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// Phase 8: Multi-Day Slots & Holiday Management
// ==========================================

// @desc    Get multi-day delivery availability (dates, slots, capacity, holidays)
// @route   GET /api/delivery-slots/available-days
// @access  Public
export const getAvailableDeliveryDays = async (req, res) => {
  try {
    const daysToLookAhead = req.query.days ? parseInt(req.query.days, 10) : 5;
    const availability = await getAvailableDays(daysToLookAhead);
    res.json({
      success: true,
      ...availability
    });
  } catch (error) {
    console.error('Failed to get available delivery days:', error);
    res.status(500).json({ message: error.message || 'Failed to calculate delivery availability' });
  }
};

// @desc    Get all shop holidays (Admin)
// @route   GET /api/admin/delivery-slots/holidays
// @access  Private (Admin)
export const getHolidaysAdmin = async (req, res) => {
  try {
    const settings = await getDeliverySettings();
    const holidays = (settings.holidays || []).sort((a, b) => a.date.localeCompare(b.date));
    res.json({
      success: true,
      holidays
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch holidays' });
  }
};

// @desc    Add a shop holiday (Admin)
// @route   POST /api/admin/delivery-slots/holidays
// @access  Private (Admin)
export const addHolidayAdmin = async (req, res) => {
  try {
    const { date, name, reason } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) {
      return res.status(400).json({ message: 'Valid holiday date in YYYY-MM-DD format is required.' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Holiday name is required.' });
    }

    const trimmedDate = String(date).trim();
    const trimmedName = String(name).trim();
    const trimmedReason = String(reason || '').trim();

    const settings = await getDeliverySettings();
    if (!Array.isArray(settings.holidays)) {
      settings.holidays = [];
    }

    const existingIndex = settings.holidays.findIndex(h => h.date === trimmedDate);
    if (existingIndex >= 0) {
      return res.status(400).json({ message: `A holiday is already scheduled for ${trimmedDate} (${settings.holidays[existingIndex].name}).` });
    }

    settings.holidays.push({
      date: trimmedDate,
      name: trimmedName,
      reason: trimmedReason
    });

    await settings.save();

    res.status(201).json({
      success: true,
      message: 'Holiday added successfully',
      holidays: settings.holidays.sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    console.error('Error adding holiday:', error);
    res.status(500).json({ message: error.message || 'Failed to add holiday' });
  }
};

// @desc    Delete a shop holiday (Admin)
// @route   DELETE /api/admin/delivery-slots/holidays/:date
// @access  Private (Admin)
export const deleteHolidayAdmin = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) {
      return res.status(400).json({ message: 'Holiday date parameter is required.' });
    }

    const settings = await getDeliverySettings();
    if (!Array.isArray(settings.holidays)) {
      settings.holidays = [];
    }

    const initialLength = settings.holidays.length;
    settings.holidays = settings.holidays.filter(h => h.date !== date.trim());

    if (settings.holidays.length === initialLength) {
      return res.status(404).json({ message: `No holiday found for date ${date}.` });
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Holiday removed successfully',
      holidays: settings.holidays.sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ message: error.message || 'Failed to delete holiday' });
  }
};

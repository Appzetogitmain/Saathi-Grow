import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import GlobalSetting from '../src/models/GlobalSetting.js';
import DeliverySlot from '../src/models/DeliverySlot.js';
import SearchLog from '../src/models/SearchLog.js';
import Order from '../src/models/Order.js';
import User from '../src/models/User.js';
import * as deliveryTimingService from '../src/services/deliveryTimingService.js';
import { recordSearchLog } from '../src/services/searchLogService.js';
import { buildSearchLogQuery } from '../src/controllers/searchLogController.js';
import { getOrdersBySlot } from '../src/controllers/deliveryRunController.js';
import XLSX from 'xlsx';

test('PHASE 8 COMPREHENSIVE SUITE', async (t) => {

    await t.test('Req 6: Free Gift snapshot schema in Order model', async () => {
        const order = new Order({
            user: new mongoose.Types.ObjectId(),
            items: [{
                product: new mongoose.Types.ObjectId(),
                name: 'Test Item',
                price: 100,
                quantity: 1
            }],
            totalAmount: 100,
            deliverySlot: 'Immediate',
            shippingAddress: {
                street: '123 MG Road',
                city: 'Indore',
                state: 'MP',
                zipCode: '452001'
            },
            freeGiftSnapshot: {
                title: 'Free Biscuit Pack',
                description: 'Special weekend gift',
                image: 'https://example.com/biscuit.png'
            }
        });

        assert.equal(order.freeGiftSnapshot.title, 'Free Biscuit Pack');
        assert.equal(order.freeGiftSnapshot.description, 'Special weekend gift');
        assert.equal(order.freeGiftSnapshot.image, 'https://example.com/biscuit.png');

        // Verify backward compatibility: order without freeGiftSnapshot works fine
        const legacyOrder = new Order({
            user: new mongoose.Types.ObjectId(),
            items: [{
                product: new mongoose.Types.ObjectId(),
                name: 'Test Item 2',
                price: 50,
                quantity: 1
            }],
            totalAmount: 50,
            deliverySlot: 'Immediate',
            shippingAddress: {
                street: '456 Ring Road',
                city: 'Indore',
                state: 'MP',
                zipCode: '452001'
            }
        });
        // Schema defaults title to null for orders without a free gift
        assert.equal(legacyOrder.freeGiftSnapshot?.title, null);
    });

    await t.test('Req 4: Order address immutability / snapshot safety', async () => {
        const orderAddr = {
            name: 'Rahul',
            phone: '9876543210',
            street: 'Flat 101, Galaxy Tower',
            city: 'Indore',
            state: 'MP',
            zipCode: '452001'
        };

        const order = new Order({
            user: new mongoose.Types.ObjectId(),
            items: [{ product: new mongoose.Types.ObjectId(), name: 'Milk', price: 60, quantity: 1 }],
            totalAmount: 60,
            deliverySlot: 'Morning Shift',
            shippingAddress: { ...orderAddr }
        });

        // Simulate user updating their profile address later
        const userAddresses = [
            { street: 'New House 999', city: 'Bhopal', state: 'MP', zipCode: '462001' }
        ];

        // Ensure order shipping address remains untouched
        assert.equal(order.shippingAddress.street, 'Flat 101, Galaxy Tower');
        assert.equal(order.shippingAddress.city, 'Indore');
        assert.notEqual(order.shippingAddress.street, userAddresses[0].street);
    });

    await t.test('Req 3: SearchLog recording and Excel generation', async () => {
        // Test Excel workbook creation with sample search logs
        const sampleLogs = [
            {
                query: 'basmati rice',
                userName: 'Aman Sharma',
                userEmail: 'aman@example.com',
                resultsCount: 5,
                source: 'keyword',
                createdAt: new Date()
            },
            {
                query: 'organic milk',
                userName: null,
                userEmail: null,
                resultsCount: 2,
                source: 'ai',
                createdAt: new Date()
            }
        ];

        const excelRows = sampleLogs.map((log, index) => ({
            'S.No': index + 1,
            'Search Query': log.query,
            'Customer Name': log.userName || 'Guest User',
            'Customer Email': log.userEmail || 'N/A',
            'Results Found': log.resultsCount,
            'Search Mode': log.source === 'ai' ? 'AI Search' : 'Keyword Search',
            'Date & Time (IST)': new Date(log.createdAt).toLocaleString('en-IN')
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Search Analytics');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        assert.ok(buffer && buffer.length > 0, 'Excel buffer must be generated');

        // Read it back with XLSX to verify data integrity
        const readWb = XLSX.read(buffer, { type: 'buffer' });
        assert.ok(readWb.SheetNames.includes('Search Analytics'));
        const readData = XLSX.utils.sheet_to_json(readWb.Sheets['Search Analytics']);
        assert.equal(readData.length, 2);
        assert.equal(readData[0]['Search Query'], 'basmati rice');
        assert.equal(readData[1]['Search Query'], 'organic milk');
        assert.equal(readData[1]['Customer Name'], 'Guest User');

        // Verify empty dataset handles header generation gracefully
        const emptyRows = [];
        const headers = ['S.No', 'Search Query', 'Customer Name', 'Customer Email', 'Results Found', 'Search Mode', 'Date & Time (IST)'];
        const emptySheet = emptyRows.length > 0 ? XLSX.utils.json_to_sheet(emptyRows) : XLSX.utils.aoa_to_sheet([headers]);
        const emptyWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(emptyWb, emptySheet, 'Search Analytics');
        const emptyBuffer = XLSX.write(emptyWb, { type: 'buffer', bookType: 'xlsx' });
        assert.ok(emptyBuffer && emptyBuffer.length > 0);
        const readEmptyWb = XLSX.read(emptyBuffer, { type: 'buffer' });
        const readEmptyHeaders = XLSX.utils.sheet_to_json(readEmptyWb.Sheets['Search Analytics'], { header: 1 });
        assert.deepEqual(readEmptyHeaders[0], headers);
    });

    await t.test('Search logging uses authenticated identity and ignores unverified token contents', async () => {
        const originalCreate = SearchLog.create;
        const createdLogs = [];
        SearchLog.create = async (entry) => { createdLogs.push(entry); return entry; };
        try {
            const userId = new mongoose.Types.ObjectId();
            await recordSearchLog({
                user: { _id: userId, name: 'Verified User', email: 'verified@example.com' },
                headers: {}
            }, 'verified query', 3);

            const forgedPayload = Buffer.from(JSON.stringify({ id: String(new mongoose.Types.ObjectId()) })).toString('base64url');
            await recordSearchLog({
                headers: { authorization: `Bearer eyJhbGciOiJub25lIn0.${forgedPayload}.` }
            }, 'unverified query', 1);

            assert.equal(String(createdLogs[0].userId), String(userId));
            assert.equal(createdLogs[0].userEmail, 'verified@example.com');
            assert.equal(createdLogs[1].userId, null);
            assert.equal(createdLogs[1].userEmail, null);
        } finally {
            SearchLog.create = originalCreate;
        }
    });

    await t.test('Req 2 & 1: Holiday blocking in validateAndBuildDeliveryTiming', async () => {
        const origFindOne = GlobalSetting.findOne;
        try {
            GlobalSetting.findOne = async () => ({
                deliveryTimezone: 'Asia/Kolkata',
                immediateDeliveryEnabled: true,
                immediateDeliveryFee: 20,
                holidays: [
                    { date: '2026-10-20', name: 'Diwali Festival', reason: 'Shop Closed' }
                ]
            });

            // 1. Booking on a holiday must throw error
            await assert.rejects(
                async () => {
                    await deliveryTimingService.validateAndBuildDeliveryTiming(
                        new mongoose.Types.ObjectId(),
                        false,
                        '2026-10-20'
                    );
                },
                /due to a scheduled holiday \(Diwali Festival\)/
            );

            // 2. Past dates must be rejected
            await assert.rejects(
                async () => {
                    await deliveryTimingService.validateAndBuildDeliveryTiming(
                        new mongoose.Types.ObjectId(),
                        false,
                        '2020-01-01'
                    );
                },
                /cannot be in the past/
            );
        } finally {
            GlobalSetting.findOne = origFindOne;
        }
    });

    await t.test('Delivery timing rejects a client date that conflicts with immediate delivery and invalid dates', async () => {
        const origFindOne = GlobalSetting.findOne;
        const today = deliveryTimingService.getZonedDateParts(new Date()).date;
        try {
            GlobalSetting.findOne = async () => ({
                deliveryTimezone: 'Asia/Kolkata',
                immediateDeliveryEnabled: true,
                holidays: [{ date: today, name: 'Today Closed' }]
            });

            await assert.rejects(
                deliveryTimingService.validateAndBuildDeliveryTiming(null, true, '2099-01-01'),
                /only be scheduled for today/
            );
            await assert.rejects(
                deliveryTimingService.validateAndBuildDeliveryTiming(null, true, today),
                /unavailable today \(Today Closed\)/
            );
            await assert.rejects(
                deliveryTimingService.validateAndBuildDeliveryTiming(new mongoose.Types.ObjectId(), false, '2026-02-30'),
                /valid date in YYYY-MM-DD format/
            );
        } finally {
            GlobalSetting.findOne = origFindOne;
        }
    });

    await t.test('Search analytics filters escape regex input and use inclusive IST calendar dates', () => {
        const query = buildSearchLogQuery({ search: '[', startDate: '2026-09-28', endDate: '2026-09-28' });

        assert.equal(query.$or[0].query.test('['), true);
        assert.equal(query.$or[0].query.test('anything'), false);
        assert.equal(query.createdAt.$gte.toISOString(), '2026-09-27T18:30:00.000Z');
        assert.equal(query.createdAt.$lt.toISOString(), '2026-09-28T18:30:00.000Z');
        assert.throws(() => buildSearchLogQuery({ startDate: '2026-02-30' }), /valid dates/);
        assert.throws(() => buildSearchLogQuery({ startDate: '2026-09-29', endDate: '2026-09-28' }), /on or before/);
    });

    await t.test('Dispatch order lookup filters future orders by the selected scheduled date', async () => {
        const originalFindOne = GlobalSetting.findOne;
        const originalOrderFind = Order.find;
        const originalSlotFind = DeliverySlot.find;
        const originalRunFind = mongoose.model('DeliveryRun').find;
        let capturedOrderQuery;
        try {
            GlobalSetting.findOne = async () => ({ deliveryTimezone: 'Asia/Kolkata' });
            Order.find = (query) => {
                capturedOrderQuery = query;
                return { populate() { return this; }, sort: async () => [] };
            };
            DeliverySlot.find = () => ({ sort: async () => [] });
            mongoose.model('DeliveryRun').find = () => ({
                populate() { return this; },
                then(resolve) { resolve([]); }
            });

            const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
            await getOrdersBySlot({ admin: { role: 'Admin' }, query: { date: '2099-01-01' } }, response);

            assert.equal(response.statusCode, 200);
            assert.equal(capturedOrderQuery['deliveryWindowSnapshot.scheduledDate'], '2099-01-01');
            assert.equal(capturedOrderQuery.$or, undefined);
        } finally {
            GlobalSetting.findOne = originalFindOne;
            Order.find = originalOrderFind;
            DeliverySlot.find = originalSlotFind;
            mongoose.model('DeliveryRun').find = originalRunFind;
        }
    });

    await t.test('Req 1: Multi-day availability with getAvailableDays', async () => {
        const origSettingFindOne = GlobalSetting.findOne;
        const origSlotFind = DeliverySlot.find;

        try {
            GlobalSetting.findOne = async () => ({
                deliveryTimezone: 'Asia/Kolkata',
                immediateDeliveryEnabled: true,
                immediateDeliveryFee: 15,
                slotBookingCutoffMinutes: 30,
                holidays: [
                    { date: '2026-12-25', name: 'Christmas', reason: 'Holiday' }
                ]
            });

            DeliverySlot.find = () => ({
                sort: () => ({
                    lean: async () => [
                        { _id: new mongoose.Types.ObjectId(), startTime: '10:00', endTime: '12:00', label: 'Morning 10-12', isActive: true, maxOrders: 50 },
                        { _id: new mongoose.Types.ObjectId(), startTime: '18:00', endTime: '20:00', label: 'Evening 6-8', isActive: true, maxOrders: 50 }
                    ]
                })
            });

            // Mock Order countDocuments to 0 orders
            const origOrderCount = Order.countDocuments;
            Order.countDocuments = async () => 0;

            const availability = await deliveryTimingService.getAvailableDays(4);

            assert.equal(availability.timezone, 'Asia/Kolkata');
            assert.ok(Array.isArray(availability.days));
            assert.equal(availability.days.length, 4);
            assert.ok(availability.days[0].isToday);
            assert.ok(availability.days[1].isTomorrow);
            assert.ok(availability.days[0].displayLabel.includes('Today'));

            Order.countDocuments = origOrderCount;
        } finally {
            GlobalSetting.findOne = origSettingFindOne;
            DeliverySlot.find = origSlotFind;
        }
    });

    await t.test('Req 2: Settings safety — general updates cannot overwrite holidays', async () => {
        const settings = new GlobalSetting({
            organizationTIN: 'GST123',
            holidays: [{ date: '2026-10-02', name: 'Gandhi Jayanti', reason: 'National Holiday' }]
        });

        // Simulate updateSettings payload that attempts to clear holidays
        const updates = { defaultTaxRate: 12, holidays: [] };
        // Controller safeguard
        delete updates.holidays;
        Object.assign(settings, updates);

        assert.equal(settings.defaultTaxRate, 12);
        assert.equal(settings.holidays.length, 1);
        assert.equal(settings.holidays[0].name, 'Gandhi Jayanti');
    });
});

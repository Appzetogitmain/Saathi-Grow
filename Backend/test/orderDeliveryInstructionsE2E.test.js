import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Order from '../src/models/Order.js';
import { sanitizeDeliveryInstructions } from '../src/controllers/orderController.js';

describe('DELIVERY INSTRUCTIONS / ORDER NOTES SUITE', () => {
  it('1. sanitizeDeliveryInstructions returns undefined for null, empty or invalid input', () => {
    assert.equal(sanitizeDeliveryInstructions(null), undefined);
    assert.equal(sanitizeDeliveryInstructions(undefined), undefined);
    assert.equal(sanitizeDeliveryInstructions(''), undefined);
    assert.equal(sanitizeDeliveryInstructions({}), undefined);
    assert.equal(sanitizeDeliveryInstructions({ chips: [], customNote: '' }), undefined);
    assert.equal(sanitizeDeliveryInstructions({ chips: ['   '], customNote: '   ' }), undefined);
  });

  it('2. sanitizeDeliveryInstructions correctly extracts and trims chips and custom note', () => {
    const input = {
      chips: [" Don't ring bell ", " Leave at door ", ""],
      customNote: "  Please call upon arrival at gate 2.  "
    };

    const sanitized = sanitizeDeliveryInstructions(input);
    assert.ok(sanitized);
    assert.deepEqual(sanitized.chips, ["Don't ring bell", "Leave at door"]);
    assert.equal(sanitized.customNote, "Please call upon arrival at gate 2.");
  });

  it('3. sanitizeDeliveryInstructions caps custom note length to 300 characters safely', () => {
    const longNote = 'A'.repeat(500);
    const sanitized = sanitizeDeliveryInstructions({ customNote: longNote });
    assert.ok(sanitized);
    assert.equal(sanitized.customNote.length, 300);
    assert.deepEqual(sanitized.chips, []);
  });

  it('4. sanitizeDeliveryInstructions works when only chips or only customNote are provided', () => {
    const onlyChips = sanitizeDeliveryInstructions({ chips: ['Call on arrival'] });
    assert.ok(onlyChips);
    assert.deepEqual(onlyChips.chips, ['Call on arrival']);
    assert.equal(onlyChips.customNote, null);

    const onlyNote = sanitizeDeliveryInstructions({ customNote: 'Ring twice' });
    assert.ok(onlyNote);
    assert.deepEqual(onlyNote.chips, []);
    assert.equal(onlyNote.customNote, 'Ring twice');
  });

  it('5. Order schema has deliveryInstructions paths configured properly', () => {
    const chipsPath = Order.schema.path('deliveryInstructions.chips');
    assert.ok(chipsPath, 'Order schema must define deliveryInstructions.chips');

    const notePath = Order.schema.path('deliveryInstructions.customNote');
    assert.ok(notePath, 'Order schema must define deliveryInstructions.customNote');
    assert.equal(notePath.instance, 'String');
  });

  it('6. Order instantiation preserves sanitized delivery instructions', () => {
    const sanitized = sanitizeDeliveryInstructions({
      chips: ["Don't ring bell", "Leave with guard"],
      customNote: "Ring apartment 402 intercom"
    });

    const order = new Order({
      orderId: 'SG-TEST-1234',
      totalAmount: 499,
      paymentMethod: 'online',
      deliveryInstructions: sanitized
    });

    assert.equal(order.deliveryInstructions.chips.length, 2);
    assert.equal(order.deliveryInstructions.chips[0], "Don't ring bell");
    assert.equal(order.deliveryInstructions.chips[1], "Leave with guard");
    assert.equal(order.deliveryInstructions.customNote, "Ring apartment 402 intercom");
  });

  it('7. Legacy orders without deliveryInstructions remain backwards-compatible', () => {
    const legacyOrder = new Order({
      orderId: 'SG-LEGACY-0001',
      totalAmount: 199,
      paymentMethod: 'cod'
    });

    assert.equal(legacyOrder.deliveryInstructions?.chips?.length || 0, 0);
    assert.equal(legacyOrder.deliveryInstructions?.customNote || null, null);
  });
});

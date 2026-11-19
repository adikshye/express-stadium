import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderItemsAndTotal,
  canTransitionOrderStatus,
  classifyReview,
  MENU_ITEMS,
  OrderRecord,
  runMonteCarloSimulation,
  scrubPii,
} from './expressLogic';

test('server-side price calculation prevents client tampering', () => {
  const { items, totalKzt } = calculateOrderItemsAndTotal([
    { menu_item_id: 1, quantity: 2 },
    { menu_item_id: 5, quantity: 1 },
  ]);
  assert.equal(items.length, 2);
  assert.equal(totalKzt, 2400 * 2 + 850);
  assert.throws(() => calculateOrderItemsAndTotal([{ menu_item_id: 999, quantity: 1 }]));
});

test('WIP limit 3 blocks moving a 4th order into in_progress', () => {
  const makeOrder = (id: string, status: OrderRecord['status']): OrderRecord => ({
    id,
    pickup_code: '12345',
    sector: 'A',
    seat: '1',
    items: [
      {
        menu_item_id: MENU_ITEMS[0].id,
        name: MENU_ITEMS[0].name,
        unit_price_kzt: MENU_ITEMS[0].price_kzt,
        quantity: 1,
        subtotal_kzt: MENU_ITEMS[0].price_kzt,
      },
    ],
    total_kzt: MENU_ITEMS[0].price_kzt,
    payment_method: 'Kaspi QR',
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const orders: OrderRecord[] = [
    makeOrder('1', 'in_progress'),
    makeOrder('2', 'in_progress'),
    makeOrder('3', 'in_progress'),
    makeOrder('4', 'new'),
  ];

  const blocked = canTransitionOrderStatus(orders, '4', 'in_progress', 3);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.code, 409);
  }

  const allowedFinish = canTransitionOrderStatus(orders, '1', 'ready', 3);
  assert.equal(allowedFinish.ok, true);
});

test('EXP-28 PII scrubber masks Kazakhstan phones and emails completely', () => {
  const raw = 'Оплата Kaspi не прошла, свяжитесь +7 701 555 44 33 или fan@stadium.kz';
  const { redactedText, piiMasked } = scrubPii(raw);
  assert.equal(piiMasked, true);
  assert.ok(redactedText.includes('[PHONE_REDACTED]'));
  assert.ok(redactedText.includes('[EMAIL_REDACTED]'));
  assert.equal(redactedText.includes('701'), false);
  assert.equal(redactedText.includes('fan@stadium.kz'), false);
});

test('LZ-12 AI review classifier categorizes all 4 domains accurately', () => {
  assert.equal(classifyReview('Списались деньги через Kaspi QR дважды').category, 'Payment Issue');
  assert.equal(classifyReview('После оплаты завис экран и кнопка не работает').category, 'App Bug');
  assert.equal(classifyReview('Кассир грубо ответил на стойке выдачи').category, 'Staff');
  assert.equal(classifyReview('Бургер холодный, но картошка вкусная').category, 'Food Quality');
});

test('LZ-6 Monte Carlo simulation returns realistic P50/P85 week forecasts', () => {
  const sim = runMonteCarloSimulation(42, 10000);
  assert.equal(sim.runs, 10000);
  assert.ok(sim.p50 >= 8 && sim.p50 <= 10, `Expected P50 around 9, got ${sim.p50}`);
  assert.ok(sim.p85 >= 10 && sim.p85 <= 12, `Expected P85 around 11, got ${sim.p85}`);
});

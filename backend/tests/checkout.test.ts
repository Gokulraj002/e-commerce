/**
 * Integration tests for the /checkout/place flow.
 *
 * Requires a running test database — set `DATABASE_URL_TEST` before
 * `vitest run`. Without it, the whole suite is skipped so pure-unit tests
 * still run in isolation. Redis + BullMQ are stubbed globally in setup.ts.
 */
import { PAYMENT_METHOD } from '@elite/shared';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { prisma } from '../src/lib/prisma.js';
import { buildApp, truncateAll } from './setup.js';
import { seedAddress, seedCustomer, seedProduct } from './helpers/factories.js';

const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

describe.skipIf(!hasTestDb)('/api/v1/checkout/place', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  test('COD happy path: creates order (CREATED), reserves inventory, clears cart', async () => {
    // Arrange
    const product = await seedProduct({
      weightG: 500,
      stockG: 20_000,
      pricePaise: 19_900,
    });
    const customer = await seedCustomer();
    const address = await seedAddress(customer.id, { pincode: '500001' });
    const authHeader = `Bearer ${customer.tokens.accessToken}`;
    const quantity = 2;

    // Act 1 — add the variant to the cart
    const addToCart = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', authHeader)
      .send({ variantId: product.variantId, quantity });
    expect(addToCart.status).toBe(200);
    expect(addToCart.body.data.items).toHaveLength(1);
    expect(addToCart.body.data.items[0].quantity).toBe(quantity);

    // Act 2 — place the order
    const placeRes = await request(app)
      .post('/api/v1/checkout/place')
      .set('Authorization', authHeader)
      .send({
        addressId: address.id,
        paymentMethod: PAYMENT_METHOD.COD,
      });

    // Assert — HTTP envelope
    expect(placeRes.status).toBe(201);
    expect(placeRes.body.success).toBe(true);
    expect(placeRes.body.data.paymentMethod).toBe(PAYMENT_METHOD.COD);
    expect(placeRes.body.data.requiresPaymentInit).toBe(false);
    expect(placeRes.body.data.order.status).toBe('CREATED');
    expect(placeRes.body.data.order.paymentMethod).toBe(PAYMENT_METHOD.COD);
    expect(placeRes.body.data.order.items).toHaveLength(1);
    expect(placeRes.body.data.order.items[0].quantity).toBe(quantity);

    // Assert — DB side-effects
    const orders = await prisma.order.findMany({
      where: { userId: customer.id },
      include: { items: true, payment: true, history: true },
    });
    expect(orders).toHaveLength(1);
    const [order] = orders;
    expect(order.status).toBe('CREATED');
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.payment?.method).toBe(PAYMENT_METHOD.COD);
    expect(order.history.length).toBeGreaterThanOrEqual(1);

    // Inventory: reservedG bumped by weightG * quantity, stockG unchanged
    // (stockG is only decremented on DELIVERED).
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: product.variantId },
    });
    expect(inventory.reservedG).toBe(product.weightG * quantity);
    expect(inventory.stockG).toBe(20_000);

    // Cart emptied and coupon cleared.
    const cart = await prisma.cart.findUniqueOrThrow({
      where: { userId: customer.id },
      include: { items: true },
    });
    expect(cart.items).toHaveLength(0);
    expect(cart.couponCode).toBeNull();
  });

  test('rejects with 400 when the cart is empty', async () => {
    const customer = await seedCustomer();
    const address = await seedAddress(customer.id, { pincode: '500001' });

    const res = await request(app)
      .post('/api/v1/checkout/place')
      .set('Authorization', `Bearer ${customer.tokens.accessToken}`)
      .send({
        addressId: address.id,
        paymentMethod: PAYMENT_METHOD.COD,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cart/i);

    // No order was created as a side-effect.
    const count = await prisma.order.count({ where: { userId: customer.id } });
    expect(count).toBe(0);
  });
});

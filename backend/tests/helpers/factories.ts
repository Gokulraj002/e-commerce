/**
 * Test data factories. Each helper builds a minimum-viable object graph via
 * Prisma + the auth service so tests can stay short and focused. Uniqueness
 * (phone, email, sku, slug) is randomised per call so factories can be
 * invoked several times in a single test without collisions.
 */
import type { Address, Inventory } from '@prisma/client';
import type { AuthTokens } from '@elite/shared';

import { prisma } from '../../src/lib/prisma.js';
import { authService } from '../../src/modules/auth/auth.service.js';

/** Cryptographically-adequate uniquifier — good enough for a test-run. */
function uniq(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build an Indian mobile phone that satisfies the shared `phoneSchema`
 * (`+91` prefix, then a 10-digit number starting with 6–9).
 */
function randomIndianPhone(): string {
  const nine = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  return `+919${nine}`;
}

// ── Product graph ───────────────────────────────────────────────────

export interface SeededProduct {
  warehouseId: string;
  categoryId: string;
  productId: string;
  variantId: string;
  inventoryId: string;
  /** Pack weight in grams — used to compute the expected reservation size. */
  weightG: number;
  /** Unit price in paise. */
  pricePaise: number;
}

/**
 * Seed a Warehouse → Category → Product → Variant → Inventory chain so
 * a customer can add the resulting variant to their cart and check out.
 * Every field is randomised so this can be called more than once per test.
 */
export async function seedProduct(overrides?: {
  weightG?: number;
  stockG?: number;
  pricePaise?: number;
}): Promise<SeededProduct> {
  const weightG = overrides?.weightG ?? 500;
  const stockG = overrides?.stockG ?? 20_000;
  const pricePaise = overrides?.pricePaise ?? 19_900;
  const suffix = uniq();

  const warehouse = await prisma.warehouse.create({
    data: {
      name: `Test Warehouse ${suffix}`,
      pincode: '500032',
      isActive: true,
    },
  });

  const category = await prisma.category.create({
    data: {
      name: 'Poultry (test)',
      slug: `poultry-${suffix}`,
      isActive: true,
    },
  });

  const product = await prisma.product.create({
    data: {
      name: 'Chicken Curry Cut (test)',
      slug: `chicken-curry-cut-${suffix}`,
      categoryId: category.id,
      isActive: true,
      tags: [],
    },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `TEST-${suffix.toUpperCase()}`,
      weightG,
      mrpPaise: pricePaise + 2000,
      pricePaise,
      isActive: true,
    },
  });

  const inventory: Inventory = await prisma.inventory.create({
    data: {
      variantId: variant.id,
      warehouseId: warehouse.id,
      stockG,
      reservedG: 0,
      reorderLevelG: 0,
    },
  });

  return {
    warehouseId: warehouse.id,
    categoryId: category.id,
    productId: product.id,
    variantId: variant.id,
    inventoryId: inventory.id,
    weightG,
    pricePaise,
  };
}

// ── Customer + address ──────────────────────────────────────────────

export interface SeededCustomer {
  id: string;
  phone: string;
  email: string;
  password: string;
  /** Argon2 hash of `password`, matches `users.passwordHash` on disk. */
  passwordHash: string;
  tokens: AuthTokens;
}

/**
 * Register a CUSTOMER through the real `authService` so the row shape
 * (Cart + Wishlist side-effects, argon2 hash) matches production. Returns
 * the plain password + argon2 hash so tests can drive both login and any
 * hash-sensitive assertions.
 */
export async function seedCustomer(overrides?: {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
}): Promise<SeededCustomer> {
  const phone = overrides?.phone ?? randomIndianPhone();
  const email = overrides?.email ?? `user-${uniq()}@example.com`;
  const password = overrides?.password ?? 'Password@123';
  const name = overrides?.name ?? 'Test Customer';

  const result = await authService.register({ name, phone, email, password });

  const created = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });

  return {
    id: result.user.id,
    phone,
    email,
    password,
    passwordHash: created.passwordHash,
    tokens: result.tokens,
  };
}

/** Attach a default delivery address to a seeded customer. */
export async function seedAddress(
  userId: string,
  overrides?: { pincode?: string; line1?: string },
): Promise<Address> {
  return prisma.address.create({
    data: {
      userId,
      label: 'Home',
      name: 'Test Customer',
      phone: '+919000009999',
      line1: overrides?.line1 ?? '221B Baker Street',
      city: 'Hyderabad',
      pincode: overrides?.pincode ?? '500001',
      isDefault: true,
    },
  });
}

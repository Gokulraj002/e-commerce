import { ROLES } from '@elite/shared';
import { Router } from 'express';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as controller from './inventory.controller.js';
import {
  adjustStockSchema,
  idParamSchema,
  listQuerySchema,
  movementQuerySchema,
  purchaseCreateSchema,
  rangeQuerySchema,
  stockListQuerySchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  variantIdParamSchema,
  warehouseCreateSchema,
  warehouseUpdateSchema,
} from './inventory.schema.js';

/**
 * Inventory module — warehouses, suppliers, stock levels, purchases
 * (stock-in), the stock-movement ledger, and valuation/wastage reports.
 * Every route is staff-only.
 */
export const inventoryRouter = Router();

// All inventory routes require an authenticated staff member.
const staff = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INVENTORY_MANAGER,
  ROLES.STORE_MANAGER,
] as const;

inventoryRouter.use(requireAuth, requireRole(...staff));

// ── Warehouses ─────────────────────────────────────────────────────
inventoryRouter.post(
  '/warehouses',
  validate(warehouseCreateSchema, 'body'),
  asyncHandler(controller.createWarehouse),
);
inventoryRouter.get('/warehouses', asyncHandler(controller.listWarehouses));
inventoryRouter.get(
  '/warehouses/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getWarehouse),
);
inventoryRouter.patch(
  '/warehouses/:id',
  validate(idParamSchema, 'params'),
  validate(warehouseUpdateSchema, 'body'),
  asyncHandler(controller.updateWarehouse),
);
inventoryRouter.delete(
  '/warehouses/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.deleteWarehouse),
);

// ── Suppliers ──────────────────────────────────────────────────────
inventoryRouter.post(
  '/suppliers',
  validate(supplierCreateSchema, 'body'),
  asyncHandler(controller.createSupplier),
);
inventoryRouter.get(
  '/suppliers',
  validate(listQuerySchema, 'query'),
  asyncHandler(controller.listSuppliers),
);
inventoryRouter.get(
  '/suppliers/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getSupplier),
);
inventoryRouter.patch(
  '/suppliers/:id',
  validate(idParamSchema, 'params'),
  validate(supplierUpdateSchema, 'body'),
  asyncHandler(controller.updateSupplier),
);
inventoryRouter.delete(
  '/suppliers/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.deleteSupplier),
);

// ── Stock levels ───────────────────────────────────────────────────
inventoryRouter.get(
  '/stock',
  validate(stockListQuerySchema, 'query'),
  asyncHandler(controller.listStock),
);
inventoryRouter.patch(
  '/stock/:variantId/adjust',
  validate(variantIdParamSchema, 'params'),
  validate(adjustStockSchema, 'body'),
  asyncHandler(controller.adjustStock),
);

// ── Low stock ──────────────────────────────────────────────────────
inventoryRouter.get('/low-stock', asyncHandler(controller.listLowStock));

// ── Purchases (stock-in) ───────────────────────────────────────────
inventoryRouter.post(
  '/purchases',
  validate(purchaseCreateSchema, 'body'),
  asyncHandler(controller.createPurchase),
);
inventoryRouter.get('/purchases', asyncHandler(controller.listPurchases));
inventoryRouter.get(
  '/purchases/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getPurchase),
);

// ── Stock movements ledger ─────────────────────────────────────────
inventoryRouter.get(
  '/movements',
  validate(movementQuerySchema, 'query'),
  asyncHandler(controller.listMovements),
);

// ── Reports ────────────────────────────────────────────────────────
inventoryRouter.get('/reports/valuation', asyncHandler(controller.getValuation));
inventoryRouter.get(
  '/reports/wastage',
  validate(rangeQuerySchema, 'query'),
  asyncHandler(controller.getWastage),
);

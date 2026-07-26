import { Router } from 'express';
import { ROLES } from '@elite/shared';

import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as ctrl from './catalog.controller.js';
import {
  createAttributeSchema,
  createBrandSchema,
  createCategorySchema,
  createImageSchema,
  createProductSchema,
  createVariantSchema,
  idParamSchema,
  imageParamSchema,
  productIdParamSchema,
  productListQuerySchema,
  slugParamSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
  variantParamSchema,
} from './catalog.schema.js';

/**
 * Catalog router — public reads use `optionalAuth`; every write requires a
 * staff role. Mounted at `/catalog` in src/routes/index.ts.
 */
export const catalogRouter = Router();

/** Staff allowed to manage the catalog. */
const requireStaff = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER);

// ── Categories ─────────────────────────────────────────────────────
catalogRouter.get('/categories', optionalAuth, asyncHandler(ctrl.getCategoryTree));
catalogRouter.get(
  '/categories/:slug',
  optionalAuth,
  validate(slugParamSchema, 'params'),
  asyncHandler(ctrl.getCategory),
);
catalogRouter.post(
  '/categories',
  requireAuth,
  requireStaff,
  validate(createCategorySchema),
  asyncHandler(ctrl.createCategory),
);
catalogRouter.patch(
  '/categories/:id',
  requireAuth,
  requireStaff,
  validate(idParamSchema, 'params'),
  validate(updateCategorySchema),
  asyncHandler(ctrl.updateCategory),
);
catalogRouter.delete(
  '/categories/:id',
  requireAuth,
  requireStaff,
  validate(idParamSchema, 'params'),
  asyncHandler(ctrl.deleteCategory),
);

// ── Brands ─────────────────────────────────────────────────────────
catalogRouter.get('/brands', optionalAuth, asyncHandler(ctrl.getBrands));
catalogRouter.post(
  '/brands',
  requireAuth,
  requireStaff,
  validate(createBrandSchema),
  asyncHandler(ctrl.createBrand),
);
catalogRouter.patch(
  '/brands/:id',
  requireAuth,
  requireStaff,
  validate(idParamSchema, 'params'),
  validate(updateBrandSchema),
  asyncHandler(ctrl.updateBrand),
);
catalogRouter.delete(
  '/brands/:id',
  requireAuth,
  requireStaff,
  validate(idParamSchema, 'params'),
  asyncHandler(ctrl.deleteBrand),
);

// ── Attributes ─────────────────────────────────────────────────────
catalogRouter.get('/attributes', optionalAuth, asyncHandler(ctrl.getAttributes));
catalogRouter.post(
  '/attributes',
  requireAuth,
  requireStaff,
  validate(createAttributeSchema),
  asyncHandler(ctrl.createAttribute),
);

// ── Products (static/specific paths before the :slug catch-all) ────
catalogRouter.get(
  '/products',
  optionalAuth,
  validate(productListQuerySchema, 'query'),
  asyncHandler(ctrl.listProducts),
);
catalogRouter.get('/products/featured', optionalAuth, asyncHandler(ctrl.getFeatured));
catalogRouter.get(
  '/products/related/:slug',
  optionalAuth,
  validate(slugParamSchema, 'params'),
  asyncHandler(ctrl.getRelated),
);
catalogRouter.post(
  '/products',
  requireAuth,
  requireStaff,
  validate(createProductSchema),
  asyncHandler(ctrl.createProduct),
);
catalogRouter.get(
  '/products/:slug',
  optionalAuth,
  validate(slugParamSchema, 'params'),
  asyncHandler(ctrl.getProduct),
);
catalogRouter.patch(
  '/products/:id',
  requireAuth,
  requireStaff,
  validate(productIdParamSchema, 'params'),
  validate(updateProductSchema),
  asyncHandler(ctrl.updateProduct),
);
catalogRouter.delete(
  '/products/:id',
  requireAuth,
  requireStaff,
  validate(productIdParamSchema, 'params'),
  asyncHandler(ctrl.deleteProduct),
);

// ── Variants ───────────────────────────────────────────────────────
catalogRouter.post(
  '/products/:id/variants',
  requireAuth,
  requireStaff,
  validate(productIdParamSchema, 'params'),
  validate(createVariantSchema),
  asyncHandler(ctrl.addVariant),
);
catalogRouter.patch(
  '/products/:id/variants/:variantId',
  requireAuth,
  requireStaff,
  validate(variantParamSchema, 'params'),
  validate(updateVariantSchema),
  asyncHandler(ctrl.updateVariant),
);
catalogRouter.delete(
  '/products/:id/variants/:variantId',
  requireAuth,
  requireStaff,
  validate(variantParamSchema, 'params'),
  asyncHandler(ctrl.deleteVariant),
);

// ── Images ─────────────────────────────────────────────────────────
catalogRouter.post(
  '/products/:id/images',
  requireAuth,
  requireStaff,
  validate(productIdParamSchema, 'params'),
  validate(createImageSchema),
  asyncHandler(ctrl.addImage),
);
catalogRouter.delete(
  '/products/:id/images/:imageId',
  requireAuth,
  requireStaff,
  validate(imageParamSchema, 'params'),
  asyncHandler(ctrl.deleteImage),
);

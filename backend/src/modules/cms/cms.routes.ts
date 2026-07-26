import { ROLES } from '@elite/shared';
import { Router } from 'express';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';

import { cmsController } from './cms.controller.js';
import {
  bannerQuerySchema,
  createBannerSchema,
  createPageSchema,
  idParamSchema,
  slugParamSchema,
  updateBannerSchema,
  updatePageSchema,
} from './cms.schema.js';

/** Content module — public storefront content + admin CRUD for pages/banners. */
export const cmsRouter = Router();

const CMS_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER] as const;
const requireCmsAdmin = requireRole(...CMS_ADMIN_ROLES);

// ── Public ─────────────────────────────────────────────────────────
cmsRouter.get(
  '/banners',
  validate(bannerQuerySchema, 'query'),
  asyncHandler(cmsController.getBanners),
);
cmsRouter.get(
  '/pages/:slug',
  validate(slugParamSchema, 'params'),
  asyncHandler(cmsController.getPage),
);

// ── Admin: pages ───────────────────────────────────────────────────
cmsRouter.get('/admin/pages', requireAuth, requireCmsAdmin, asyncHandler(cmsController.listPages));
cmsRouter.post(
  '/admin/pages',
  requireAuth,
  requireCmsAdmin,
  validate(createPageSchema),
  asyncHandler(cmsController.createPage),
);
cmsRouter.put(
  '/admin/pages/:id',
  requireAuth,
  requireCmsAdmin,
  validate(idParamSchema, 'params'),
  validate(updatePageSchema),
  asyncHandler(cmsController.updatePage),
);
cmsRouter.delete(
  '/admin/pages/:id',
  requireAuth,
  requireCmsAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(cmsController.deletePage),
);

// ── Admin: banners ─────────────────────────────────────────────────
cmsRouter.get(
  '/admin/banners',
  requireAuth,
  requireCmsAdmin,
  asyncHandler(cmsController.listBanners),
);
cmsRouter.post(
  '/admin/banners',
  requireAuth,
  requireCmsAdmin,
  validate(createBannerSchema),
  asyncHandler(cmsController.createBanner),
);
cmsRouter.put(
  '/admin/banners/:id',
  requireAuth,
  requireCmsAdmin,
  validate(idParamSchema, 'params'),
  validate(updateBannerSchema),
  asyncHandler(cmsController.updateBanner),
);
cmsRouter.delete(
  '/admin/banners/:id',
  requireAuth,
  requireCmsAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(cmsController.deleteBanner),
);

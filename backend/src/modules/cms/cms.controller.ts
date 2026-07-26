import type { Request, Response } from 'express';

import { created, ok } from '../../utils/http.js';

import { cmsService } from './cms.service.js';

/** Thin controllers — parse req, delegate to service, format via ok/created. */
export const cmsController = {
  // Public
  getPage: async (req: Request, res: Response) =>
    ok(res, await cmsService.getPublicPage(req.params.slug)),

  getBanners: async (req: Request, res: Response) => {
    const position = (req.query as { position?: string }).position;
    return ok(res, await cmsService.listPublicBanners(position));
  },

  // Admin: pages
  listPages: async (_req: Request, res: Response) => ok(res, await cmsService.listPages()),

  createPage: async (req: Request, res: Response) =>
    created(res, await cmsService.createPage(req.body), 'Page created'),

  updatePage: async (req: Request, res: Response) =>
    ok(res, await cmsService.updatePage(req.params.id, req.body), 'Page updated'),

  deletePage: async (req: Request, res: Response) =>
    ok(res, await cmsService.deletePage(req.params.id), 'Page deleted'),

  // Admin: banners
  listBanners: async (_req: Request, res: Response) => ok(res, await cmsService.listAllBanners()),

  createBanner: async (req: Request, res: Response) =>
    created(res, await cmsService.createBanner(req.body), 'Banner created'),

  updateBanner: async (req: Request, res: Response) =>
    ok(res, await cmsService.updateBanner(req.params.id, req.body), 'Banner updated'),

  deleteBanner: async (req: Request, res: Response) =>
    ok(res, await cmsService.deleteBanner(req.params.id), 'Banner deleted'),
};

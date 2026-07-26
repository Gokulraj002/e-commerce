import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** Prisma access only — no business logic. */
export const cmsRepository = {
  findPageBySlug(slug: string) {
    return prisma.cmsPage.findUnique({ where: { slug } });
  },
  findPageById(id: string) {
    return prisma.cmsPage.findUnique({ where: { id } });
  },
  listPages() {
    return prisma.cmsPage.findMany({ orderBy: { updatedAt: 'desc' } });
  },
  createPage(data: Prisma.CmsPageCreateInput) {
    return prisma.cmsPage.create({ data });
  },
  updatePage(id: string, data: Prisma.CmsPageUpdateInput) {
    return prisma.cmsPage.update({ where: { id }, data });
  },
  deletePage(id: string) {
    return prisma.cmsPage.delete({ where: { id } });
  },

  listBanners(where: Prisma.BannerWhereInput) {
    return prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  },
  findBannerById(id: string) {
    return prisma.banner.findUnique({ where: { id } });
  },
  createBanner(data: Prisma.BannerCreateInput) {
    return prisma.banner.create({ data });
  },
  updateBanner(id: string, data: Prisma.BannerUpdateInput) {
    return prisma.banner.update({ where: { id }, data });
  },
  deleteBanner(id: string) {
    return prisma.banner.delete({ where: { id } });
  },
};

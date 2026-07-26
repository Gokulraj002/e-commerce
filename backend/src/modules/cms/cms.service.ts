import type { Banner, CmsPage } from '@prisma/client';

import { ApiError } from '../../utils/ApiError.js';

import { cmsRepository } from './cms.repository.js';
import type {
  CreateBannerInput,
  CreatePageInput,
  UpdateBannerInput,
  UpdatePageInput,
} from './cms.schema.js';
import type { BannerDTO, CmsPageDTO } from './cms.types.js';

function toPageDTO(p: CmsPage): CmsPageDTO {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    content: p.content,
    isPublished: p.isPublished,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toBannerDTO(b: Banner): BannerDTO {
  return {
    id: b.id,
    title: b.title,
    imageUrl: b.imageUrl,
    link: b.link,
    position: b.position,
    sortOrder: b.sortOrder,
    isActive: b.isActive,
  };
}

/** Business logic for CMS pages + banners. Throws ApiError; never touches res. */
export const cmsService = {
  // ── Public ──────────────────────────────────────────────────────
  async getPublicPage(slug: string): Promise<CmsPageDTO> {
    const page = await cmsRepository.findPageBySlug(slug);
    if (!page || !page.isPublished) throw ApiError.notFound('Page not found');
    return toPageDTO(page);
  },

  async listPublicBanners(position?: string): Promise<BannerDTO[]> {
    const banners = await cmsRepository.listBanners({
      isActive: true,
      ...(position ? { position } : {}),
    });
    return banners.map(toBannerDTO);
  },

  // ── Admin: pages ────────────────────────────────────────────────
  async listPages(): Promise<CmsPageDTO[]> {
    const pages = await cmsRepository.listPages();
    return pages.map(toPageDTO);
  },

  async createPage(input: CreatePageInput): Promise<CmsPageDTO> {
    const existing = await cmsRepository.findPageBySlug(input.slug);
    if (existing) throw ApiError.conflict('A page with this slug already exists');
    const page = await cmsRepository.createPage(input);
    return toPageDTO(page);
  },

  async updatePage(id: string, input: UpdatePageInput): Promise<CmsPageDTO> {
    const existing = await cmsRepository.findPageById(id);
    if (!existing) throw ApiError.notFound('Page not found');
    if (input.slug && input.slug !== existing.slug) {
      const clash = await cmsRepository.findPageBySlug(input.slug);
      if (clash) throw ApiError.conflict('A page with this slug already exists');
    }
    const page = await cmsRepository.updatePage(id, input);
    return toPageDTO(page);
  },

  async deletePage(id: string): Promise<{ id: string }> {
    const existing = await cmsRepository.findPageById(id);
    if (!existing) throw ApiError.notFound('Page not found');
    await cmsRepository.deletePage(id);
    return { id };
  },

  // ── Admin: banners ──────────────────────────────────────────────
  async listAllBanners(): Promise<BannerDTO[]> {
    const banners = await cmsRepository.listBanners({});
    return banners.map(toBannerDTO);
  },

  async createBanner(input: CreateBannerInput): Promise<BannerDTO> {
    const banner = await cmsRepository.createBanner(input);
    return toBannerDTO(banner);
  },

  async updateBanner(id: string, input: UpdateBannerInput): Promise<BannerDTO> {
    const existing = await cmsRepository.findBannerById(id);
    if (!existing) throw ApiError.notFound('Banner not found');
    const banner = await cmsRepository.updateBanner(id, input);
    return toBannerDTO(banner);
  },

  async deleteBanner(id: string): Promise<{ id: string }> {
    const existing = await cmsRepository.findBannerById(id);
    if (!existing) throw ApiError.notFound('Banner not found');
    await cmsRepository.deleteBanner(id);
    return { id };
  },
};

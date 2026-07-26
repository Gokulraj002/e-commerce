/** Module-local DTOs for CMS pages and marketing banners (client-safe shapes). */

export interface CmsPageDTO {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface BannerDTO {
  id: string;
  title: string | null;
  imageUrl: string;
  link: string | null;
  position: string;
  sortOrder: number;
  isActive: boolean;
}

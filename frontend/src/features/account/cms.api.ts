/**
 * CMS page API. The public content type is backend-local (not part of the
 * shared DTO surface), so it is declared here for the storefront.
 */
import { apiClient } from '@/lib/apiClient';

export interface CmsPageDTO {
  id: string;
  slug: string;
  title: string;
  /** Rich HTML body authored in the admin CMS. */
  content: string;
  isPublished: boolean;
  updatedAt: string;
}

/** GET /cms/pages/:slug — a published content page (about, terms, privacy…). */
export async function fetchCmsPage(slug: string): Promise<CmsPageDTO> {
  const { data } = await apiClient.get<CmsPageDTO>(`/cms/pages/${slug}`);
  return data;
}

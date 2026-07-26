/**
 * Public CMS page query. Content pages are public (no auth) and change rarely,
 * so a longer staleTime is appropriate.
 */
import { useQuery } from '@tanstack/react-query';

import { fetchCmsPage } from './cms.api';

export function useCmsPage(slug: string | undefined) {
  return useQuery({
    queryKey: ['cms-page', slug],
    queryFn: () => fetchCmsPage(slug as string),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}

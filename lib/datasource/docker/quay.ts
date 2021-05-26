import { logger } from '../../logger';
import { getAuthHeaders, http } from './common';

export async function getTagsQuayRegistry(
  repository: string
): Promise<string[]> {
  const registry = 'https://quay.io';
  let tags: string[] = [];
  const limit = 100;
  const headers = await getAuthHeaders(registry, repository);
  if (!headers) {
    logger.debug('Failed to get authHeaders for getTagsQuayRegistry lookup');
    return null;
  }

  const pageUrl = (page: number): string =>
    `${registry}/api/v1/repository/${repository}/tag/?limit=${limit}&page=${page}&onlyActiveTags=true`;

  let page = 1;
  let url = pageUrl(page);
  do {
    const res = await http.getJson<{
      tags: { name: string }[];
      has_additional: boolean;
    }>(url, { headers });
    const pageTags = res.body.tags.map((tag) => tag.name);
    tags = tags.concat(pageTags);
    page += 1;
    url = res.body.has_additional ? pageUrl(page) : null;
  } while (url && page < 20);
  return tags;
}

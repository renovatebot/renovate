import { http } from './common';

export async function getTagsQuayRegistry(
  registry: string,
  repository: string
): Promise<string[]> {
  let tags: string[] = [];
  const limit = 100;

  const pageUrl = (page: number): string =>
    `${registry}/api/v1/repository/${repository}/tag/?limit=${limit}&page=${page}&onlyActiveTags=true`;

  let page = 1;
  let url = pageUrl(page);
  do {
    const res = await http.getJson<{
      tags: { name: string }[];
      has_additional: boolean;
    }>(url, {});
    const pageTags = res.body.tags.map((tag) => tag.name);
    tags = tags.concat(pageTags);
    page += 1;
    url = res.body.has_additional ? pageUrl(page) : null;
  } while (url && page < 20);
  return tags;
}

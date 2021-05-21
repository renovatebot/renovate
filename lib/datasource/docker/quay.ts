import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { http } from './common';

export async function getTagsQuayRegistry(
  repository: string
): Promise<string[] | null> {
  const registry = 'https://quay.io';
  let tags: string[] = [];
  try {
    const cacheNamespace = 'datasource-docker-tags';
    const cacheKey = `${registry}:${repository}`;
    const cachedResult = await packageCache.get<string[]>(
      cacheNamespace,
      cacheKey
    );
    // istanbul ignore if
    if (cachedResult !== undefined) {
      return cachedResult;
    }
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
    const cacheMinutes = 30;
    await packageCache.set(cacheNamespace, cacheKey, tags, cacheMinutes);
    return tags;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn(
        { registry, dockerRepository: repository, err },
        'docker registry failure: internal error'
      );
      throw new ExternalHostError(err);
    }
    throw err;
  }
}

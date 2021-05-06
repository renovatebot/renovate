import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { getAuthHeaders } from './common';

const id = 'docker';
const http = new Http(id);

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
    const limit = 10000;

    let page = 1;
    let url = `${registry}/api/v1/repository/${repository}/tag/?limit=${limit}&page=${page}`;
    const headers = await getAuthHeaders(id, http, registry, repository);
    if (!headers) {
      logger.debug('Failed to get authHeaders for getTags lookup');
      return null;
    }
    do {
      const res = await http.getJson<{
        tags: { name: string }[];
        has_additional: boolean;
      }>(url, {
        headers,
      });
      const pageTags = res.body.tags.map((tag) => tag.name);
      url = res.body.has_additional
        ? `${registry}/api/v1/repository/${repository}/tag/?limit=${limit}&page=${page}&onlyActiveTags=true`
        : null;
      tags = tags.concat(pageTags);
      page += 1;
    } while (url && page < 20);
    const cacheMinutes = 30;
    await packageCache.set(cacheNamespace, cacheKey, tags, cacheMinutes);
    return tags;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.statusCode === 404 && !repository.includes('/')) {
      logger.debug(
        `Retrying Tags for ${registry}/${repository} using library/ prefix`
      );
      return getTagsQuayRegistry('library/' + repository);
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

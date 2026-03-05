import { isPlainObject } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { HttpCacheStats } from '../../stats.ts';
import type { GotOptions, HttpResponse } from '../types.ts';
import { copyResponse } from '../util.ts';
import { HttpCache } from './schema.ts';
import type { HttpCacheProvider } from './types.ts';

export abstract class AbstractHttpCacheProvider implements HttpCacheProvider {
  protected abstract load(method: string, url: string): Promise<unknown>;
  protected abstract persist(
    method: string,
    url: string,
    data: HttpCache,
  ): Promise<void>;

  async get(method: string, url: string): Promise<HttpCache | null> {
    const cache = await this.load(method, url);
    const httpCache = HttpCache.parse(cache);
    if (!httpCache) {
      return null;
    }

    // v8 ignore else -- TODO: add test #40625
    if (isPlainObject(httpCache.httpResponse)) {
      httpCache.httpResponse.cached = true;
    }

    return httpCache;
  }

  async setCacheHeaders<T extends Pick<GotOptions, 'headers'>>(
    method: string,
    url: string,
    opts: T,
  ): Promise<void> {
    const httpCache = await this.get(method, url);
    if (!httpCache) {
      return;
    }

    opts.headers ??= {};

    if (httpCache.etag) {
      opts.headers['If-None-Match'] = httpCache.etag;
    }

    if (httpCache.lastModified) {
      opts.headers['If-Modified-Since'] = httpCache.lastModified;
    }
  }

  // v8 ignore next -- TODO: add test #40625
  bypassServer<T>(
    _method: string,
    _url: string,
    _ignoreSoftTtl: boolean,
  ): Promise<HttpResponse<T> | null> {
    return Promise.resolve(null);
  }

  async wrapServerResponse<T>(
    method: string,
    url: string,
    resp: HttpResponse<T>,
  ): Promise<HttpResponse<T>> {
    if (!resp.cached && resp.statusCode === 200) {
      const etag = resp.headers?.etag;
      const lastModified = resp.headers?.['last-modified'];

      HttpCacheStats.incRemoteMisses(url);

      const httpResponse = copyResponse(resp, true);
      const timestamp = new Date().toISOString();

      const newHttpCache = HttpCache.parse({
        etag,
        lastModified,
        httpResponse,
        timestamp,
      });

      /* v8 ignore next: should never happen */
      if (!newHttpCache) {
        logger.debug(`http cache: failed to persist cache for ${url}`);
        return resp;
      }

      logger.debug(
        `http cache: saving ${url} (etag=${etag}, lastModified=${lastModified})`,
      );
      await this.persist(method, url, newHttpCache as HttpCache);
      return resp;
    }

    if (resp.statusCode === 304) {
      const httpCache = await this.get(method, url);
      if (!httpCache) {
        return resp;
      }

      const timestamp = httpCache.timestamp;
      logger.debug(
        `http cache: Using cached response: ${url} from ${timestamp}`,
      );
      httpCache.timestamp = new Date().toISOString();
      await this.persist(method, url, httpCache);

      HttpCacheStats.incRemoteHits(url);
      const cachedResp = copyResponse(
        httpCache.httpResponse as HttpResponse<T>,
        true,
      );
      cachedResp.authorization = resp.authorization;
      return cachedResp;
    }

    return resp;
  }
}

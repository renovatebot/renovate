import { DateTime } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { HttpCacheStats } from '../../stats.ts';
import type { GotOptions, HttpResponse } from '../types.ts';
import { copyResponse } from '../util.ts';
import { persistedResponseHeaders, pickHeaders } from './persisted-headers.ts';
import { HttpCache, type HttpCacheResponse } from './schema.ts';
import type { HttpCacheProvider } from './types.ts';

export abstract class AbstractHttpCacheProvider implements HttpCacheProvider {
  /** the response headers kept in a persisted entry, or `null` to keep all */
  protected readonly persistedHeaders: readonly string[] | null =
    persistedResponseHeaders;

  protected abstract load(method: string, url: string): Promise<unknown>;
  protected abstract persist(
    method: string,
    url: string,
    data: HttpCache,
  ): Promise<void>;

  /**
   * Reduces the headers of a persisted or loaded response to `persistedHeaders`.
   *
   * @returns whether any header was dropped
   */
  private pickPersistedHeaders(
    response: Pick<HttpCacheResponse, 'headers'>,
  ): boolean {
    if (!this.persistedHeaders) {
      return false;
    }
    const headers = pickHeaders(response.headers, this.persistedHeaders);
    const dropped =
      Object.keys(headers).length < Object.keys(response.headers).length;
    response.headers = headers;
    return dropped;
  }

  async get(method: string, url: string): Promise<HttpCache | null> {
    const cache = await this.load(method, url);
    const httpCache = HttpCache.parse(cache);
    if (!httpCache) {
      return null;
    }

    httpCache.httpResponse.cached = true;
    // ensure that a previous cache entry, which may not have filtered all headers, has had the header filtering applied
    if (this.pickPersistedHeaders(httpCache.httpResponse)) {
      await this.persist(method, url, httpCache);
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
      this.pickPersistedHeaders(httpResponse);
      const timestamp = DateTime.utc().toISO();

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
      await this.persist(method, url, newHttpCache);
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
      httpCache.timestamp = DateTime.utc().toISO();
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

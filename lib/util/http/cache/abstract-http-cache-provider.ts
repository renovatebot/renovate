import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import { HttpCacheStats } from '../../stats';
import type { GotOptions, HttpResponse } from '../types';
import { copyResponse } from '../util';
import { type HttpCache, HttpCacheSchema } from './schema';
import type { HttpCacheProvider } from './types';

export abstract class AbstractHttpCacheProvider implements HttpCacheProvider {
  protected abstract softTtlMinutes: number;
  protected abstract hardTtlMinutes: number;

  protected abstract load(url: string): Promise<unknown>;
  protected abstract persist(url: string, data: HttpCache): Promise<void>;

  async get(url: string): Promise<HttpCache | null> {
    const cache = await this.load(url);
    const httpCache = HttpCacheSchema.parse(cache);
    if (!httpCache) {
      return null;
    }

    return httpCache as HttpCache;
  }

  async setCacheHeaders<T extends Pick<GotOptions, 'headers'>>(
    url: string,
    opts: T,
  ): Promise<void> {
    const httpCache = await this.get(url);
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

  async bypassServer<T>(
    url: string,
    ignoreSoftTtl: boolean,
  ): Promise<HttpResponse<T> | null> {
    const cached = await this.get(url);
    if (!cached) {
      return null;
    }

    if (ignoreSoftTtl) {
      return cached.httpResponse as HttpResponse<T>;
    }

    const cachedAt = DateTime.fromISO(cached.timestamp);
    const deadline = cachedAt.plus({ minutes: this.softTtlMinutes });
    const now = DateTime.now();
    if (now >= deadline) {
      HttpCacheStats.incLocalMisses(url);
      return null;
    }

    HttpCacheStats.incLocalHits(url);
    return cached.httpResponse as HttpResponse<T>;
  }

  async wrapServerResponse<T>(
    url: string,
    resp: HttpResponse<T>,
  ): Promise<HttpResponse<T>> {
    if (resp.statusCode === 200) {
      const etag = resp.headers?.['etag'];
      const lastModified = resp.headers?.['last-modified'];

      HttpCacheStats.incRemoteMisses(url);

      const httpResponse = copyResponse(resp, true);
      const timestamp = new Date().toISOString();

      const newHttpCache = HttpCacheSchema.parse({
        etag,
        lastModified,
        httpResponse,
        timestamp,
      });
      /* istanbul ignore else */
      if (newHttpCache) {
        logger.debug(
          `http cache: saving ${url} (etag=${etag}, lastModified=${lastModified})`,
        );
        await this.persist(url, newHttpCache as HttpCache);
      } else {
        logger.debug(`http cache: failed to persist cache for ${url}`);
      }

      return resp;
    }

    if (resp.statusCode === 304) {
      const httpCache = await this.get(url);
      if (!httpCache) {
        return resp;
      }

      const timestamp = httpCache.timestamp;
      logger.debug(
        `http cache: Using cached response: ${url} from ${timestamp}`,
      );
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

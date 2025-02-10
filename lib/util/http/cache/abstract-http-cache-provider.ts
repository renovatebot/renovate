import { logger } from '../../../logger';
import { regEx } from '../../regex';
import { HttpCacheStats } from '../../stats';
import type { GotOptions, HttpResponse } from '../types';
import { copyResponse } from '../util';
import { type HttpCache, HttpCacheSchema } from './schema';
import type { HttpCacheProvider } from './types';

export abstract class AbstractHttpCacheProvider implements HttpCacheProvider {
  protected checkCacheControlHeader = true;

  protected abstract load(url: string): Promise<unknown>;
  protected abstract persist(url: string, data: HttpCache): Promise<void>;

  async get(url: string): Promise<HttpCache | null> {
    const cache = await this.load(url);
    const httpCache = HttpCacheSchema.parse(cache);
    if (!httpCache) {
      return null;
    }

    return httpCache;
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

  bypassServer<T>(
    _url: string,
    _ignoreSoftTtl: boolean,
  ): Promise<HttpResponse<T> | null> {
    return Promise.resolve(null);
  }

  private preventCaching<T>(resp: HttpResponse<T>): boolean {
    if (this.checkCacheControlHeader === false) {
      return false;
    }

    const isPublic = resp.headers?.['cache-control']
      ?.toLocaleLowerCase()
      .split(regEx(/\s*,\s*/))
      .includes('public');

    return !isPublic;
  }

  async wrapServerResponse<T>(
    url: string,
    resp: HttpResponse<T>,
  ): Promise<HttpResponse<T>> {
    if (resp.statusCode === 200) {
      if (this.preventCaching(resp)) {
        return resp;
      }

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

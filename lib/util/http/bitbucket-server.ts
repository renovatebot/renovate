import is from '@sindresorhus/is';
import { HttpBase, type InternalJsonUnsafeOptions } from './http';
import type { HttpMethod, HttpOptions, HttpResponse } from './types';

const MAX_LIMIT = 100;
const MAX_PAGES = 100;

let baseUrl: string;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export interface BitbucketServerHttpOptions extends HttpOptions {
  paginate?: boolean;
  limit?: number;
  maxPages?: number;
}

interface PagedResult<T = unknown> {
  nextPageStart?: number;
  values: T[];
}

export class BitbucketServerHttp extends HttpBase<BitbucketServerHttpOptions> {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(type = 'bitbucket-server', options?: BitbucketServerHttpOptions) {
    super(type, options);
  }

  protected override async requestJsonUnsafe<T>(
    method: HttpMethod,
    options: InternalJsonUnsafeOptions<BitbucketServerHttpOptions>,
  ): Promise<HttpResponse<T>> {
    const resolvedUrl = this.resolveUrl(options.url, options.httpOptions);
    const opts = { ...options, url: resolvedUrl };
    opts.httpOptions ??= {};
    opts.httpOptions.headers ??= {};
    opts.httpOptions.headers['X-Atlassian-Token'] = 'no-check';

    const paginate = opts.httpOptions.paginate;
    if (paginate) {
      const limit = opts.httpOptions.limit ?? MAX_LIMIT;
      resolvedUrl.searchParams.set('limit', limit.toString());
    }

    const result = await super.requestJsonUnsafe<T | PagedResult<T>>(
      method,
      opts,
    );

    if (paginate && isPagedResult(result.body)) {
      if (opts.httpOptions) {
        delete opts.httpOptions.cacheProvider;
        opts.httpOptions.memCache = false;
      }

      const collectedValues = [...result.body.values];
      let nextPageStart = result.body.nextPageStart;

      let maxPages = opts.httpOptions.maxPages ?? MAX_PAGES;
      while (nextPageStart && --maxPages > 0) {
        resolvedUrl.searchParams.set('start', nextPageStart.toString());

        const nextResult = await super.requestJsonUnsafe<PagedResult<T>>(
          method,
          opts,
        );
        collectedValues.push(...nextResult.body.values);
        nextPageStart = nextResult.body.nextPageStart;
      }

      return { ...result, body: collectedValues as T };
    }

    return result as HttpResponse<T>;
  }
}

function isPagedResult(obj: unknown): obj is PagedResult {
  return is.nonEmptyObject(obj) && is.array(obj.values);
}

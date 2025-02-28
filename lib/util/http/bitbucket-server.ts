import is from '@sindresorhus/is';
import { logger } from '../../logger';
import { parseUrl, resolveBaseUrl } from '../url';
import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from '.';

const MAX_LIMIT = 100;

let baseUrl: string;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export interface BitbucketServerHttpOptions extends HttpOptions {
  paginate?: boolean;
  limit?: number;
}

interface PagedResult<T = unknown> {
  nextPageStart?: number;
  values: T[];
}

export class BitbucketServerHttp extends Http<BitbucketServerHttpOptions> {
  constructor(options?: HttpOptions) {
    super('bitbucket-server', options);
  }

  protected override async request<T>(
    path: string,
    options?: InternalHttpOptions & BitbucketServerHttpOptions,
  ): Promise<HttpResponse<T>> {
    const opts = { baseUrl, ...options };
    opts.headers = { ...opts.headers, 'X-Atlassian-Token': 'no-check' };

    const resolvedUrl = parseUrl(resolveBaseUrl(baseUrl, path));
    if (!resolvedUrl) {
      logger.error({ path }, 'Bitbucket Server: cannot parse path');
      throw new Error(`Bitbucket Server: cannot parse path ${path}`);
    }

    if (opts.paginate) {
      const limit = opts.limit ?? MAX_LIMIT;
      resolvedUrl.searchParams.set('limit', limit.toString());
    }

    const result = await super.request<T | PagedResult<T>>(
      resolvedUrl.toString(),
      opts,
    );

    if (opts.paginate && isPagedResult(result.body)) {
      const collectedValues = [...result.body.values];
      let nextPageStart = result.body.nextPageStart;

      while (nextPageStart) {
        resolvedUrl.searchParams.set('start', nextPageStart.toString());

        const nextResult = await super.request<PagedResult<T>>(
          resolvedUrl.toString(),
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

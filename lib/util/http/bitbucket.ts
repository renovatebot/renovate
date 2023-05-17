import is from '@sindresorhus/is';
import { logger } from '../../logger';
import type { PagedResult } from '../../modules/platform/bitbucket/types';
import { parseUrl, resolveBaseUrl } from '../url';
import type { HttpOptions, HttpResponse } from './types';
import { Http } from '.';

const MAX_PAGELEN = 100;

let baseUrl = 'https://api.bitbucket.org/';

export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export interface BitbucketHttpOptions extends HttpOptions {
  paginate?: boolean;
  pagelen?: number;
}

export class BitbucketHttp extends Http<BitbucketHttpOptions> {
  constructor(type = 'bitbucket', options?: BitbucketHttpOptions) {
    super(type, options);
  }

  protected override async request<T>(
    path: string,
    options?: BitbucketHttpOptions
  ): Promise<HttpResponse<T>> {
    const opts = { baseUrl, ...options };

    let resolvedURL = parseUrl(resolveBaseUrl(baseUrl, path));

    // istanbul ignore if: this should never happen
    if (is.nullOrUndefined(resolvedURL)) {
      logger.error(`Bitbucket: cannot parse path ${path}`);
      throw new Error(`Bitbucket: cannot parse path ${path}`);
    }

    if (opts.paginate && !hasPagelen(resolvedURL)) {
      const pagelen = opts.pagelen ?? MAX_PAGELEN;
      resolvedURL = addPagelenToPath(resolvedURL, pagelen);
    }

    const result = await super.request<T>(resolvedURL.toString(), opts);

    if (opts.paginate && isPagedResult(result.body)) {
      const resultBody = result.body as PagedResult<T>;

      let nextURL = resultBody.next;

      while (is.nonEmptyString(nextURL)) {
        const nextResult = await super.request<PagedResult<T>>(
          nextURL,
          options
        );

        resultBody.values.push(...nextResult.body.values);

        nextURL = nextResult.body?.next;
      }

      // Override other page-related attributes
      resultBody.pagelen = resultBody.values.length;
      resultBody.size = resultBody.values.length;
      resultBody.next = undefined;
    }

    return result;
  }
}

function hasPagelen(url: URL): boolean {
  return !is.nullOrUndefined(url.searchParams.get('pagelen'));
}

function addPagelenToPath(url: URL, pagelen: number): URL {
  url.searchParams.set('pagelen', pagelen.toString());
  return url;
}

function isPagedResult(obj: any): obj is PagedResult {
  return is.nonEmptyObject(obj) && Array.isArray(obj.values);
}

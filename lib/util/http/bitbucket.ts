import is from '@sindresorhus/is';
import { logger } from '../../logger';
import type { PagedResult } from '../../modules/platform/bitbucket/types';
import { parseUrl, resolveBaseUrl } from '../url';
import type { HttpOptions, HttpRequestOptions, HttpResponse } from './types';
import { Http } from '.';

const MAX_PAGES = 100;
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
    options?: BitbucketHttpOptions & HttpRequestOptions<T>,
  ): Promise<HttpResponse<T>> {
    const opts = { baseUrl, ...options };

    const resolvedURL = parseUrl(resolveBaseUrl(baseUrl, path));

    // istanbul ignore if: this should never happen
    if (is.nullOrUndefined(resolvedURL)) {
      logger.error({ path }, 'Bitbucket: cannot parse path');
      throw new Error(`Bitbucket: cannot parse path ${path}`);
    }

    if (opts.paginate && !hasPagelen(resolvedURL)) {
      const pagelen = opts.pagelen ?? MAX_PAGELEN;
      resolvedURL.searchParams.set('pagelen', pagelen.toString());
    }

    const result = await super.request<T>(resolvedURL.toString(), opts);

    if (opts.paginate && isPagedResult(result.body)) {
      const resultBody = result.body as PagedResult<T>;
      let page = 1;
      let nextURL = resultBody.next;

      while (is.nonEmptyString(nextURL) && page <= MAX_PAGES) {
        const nextResult = await super.request<PagedResult<T>>(
          nextURL,
          options as BitbucketHttpOptions,
        );

        resultBody.values.push(...nextResult.body.values);

        nextURL = nextResult.body?.next;
        page += 1;
      }

      // Override other page-related attributes
      resultBody.pagelen = resultBody.values.length;
      resultBody.size =
        page <= MAX_PAGES
          ? resultBody.values.length
          : /* istanbul ignore next */ undefined;
      resultBody.next =
        page <= MAX_PAGES ? nextURL : /* istanbul ignore next */ undefined;
    }

    return result;
  }
}

function hasPagelen(url: URL): boolean {
  return !is.nullOrUndefined(url.searchParams.get('pagelen'));
}

function isPagedResult(obj: any): obj is PagedResult {
  return is.nonEmptyObject(obj) && Array.isArray(obj.values);
}

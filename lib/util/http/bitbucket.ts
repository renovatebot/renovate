import is from '@sindresorhus/is';
import type { PagedResult } from '../../modules/platform/bitbucket/types';
import { parseUrl, resolveBaseUrl } from '../url';
import type { HttpOptions, HttpResponse } from './types';
import { Http } from '.';

let baseUrl = 'https://api.bitbucket.org/';

export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export interface BitbucketHttpOptions extends HttpOptions {
  paginate?: boolean;
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

    const result = await super.request<T>(path, opts);

    if (opts.paginate && isPagedResult(result.body)) {
      const resultBody = result.body as PagedResult<T>;

      let nextPage = getPageFromURL(resultBody.next);

      while (is.nonEmptyString(nextPage)) {
        const nextPath = getNextPagePath(path, nextPage);

        if (is.nullOrUndefined(nextPath)) {
          break;
        }

        const nextResult = await super.request<PagedResult<T>>(
          nextPath,
          options
        );

        resultBody.values.push(...nextResult.body.values);

        nextPage = getPageFromURL(nextResult.body?.next);
      }

      // Override other page-related attributes
      resultBody.pagelen = resultBody.values.length;
      resultBody.size = resultBody.values.length;
      resultBody.next = undefined;
    }

    return result;
  }
}

function getPageFromURL(url: string | undefined): string | null {
  const resolvedURL = parseUrl(url);

  if (is.nullOrUndefined(resolvedURL)) {
    return null;
  }

  return resolvedURL.searchParams.get('page');
}

function getNextPagePath(path: string, nextPage: string): string | null {
  const resolvedURL = parseUrl(resolveBaseUrl(baseUrl, path));

  if (is.nullOrUndefined(resolvedURL)) {
    return null;
  }

  resolvedURL.searchParams.set('page', nextPage);

  return resolvedURL.toString();
}

function isPagedResult(obj: any): obj is PagedResult {
  return is.nonEmptyObject(obj) && Array.isArray(obj.values);
}

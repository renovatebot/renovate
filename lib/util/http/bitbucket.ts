import is from '@sindresorhus/is';
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

    let pathWithPagelen = path;

    if ((opts.paginate || opts.pagelen) && !hasPagelen(pathWithPagelen)) {
      pathWithPagelen = addPagelenToPath(pathWithPagelen, opts.pagelen);
    }

    const result = await super.request<T>(pathWithPagelen, opts);

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

function hasPagelen(path: string): boolean {
  const resolvedURL = parseUrl(resolveBaseUrl(baseUrl, path));

  if (is.nullOrUndefined(resolvedURL)) {
    return false;
  }

  return !is.nullOrUndefined(resolvedURL.searchParams.get('pagelen'));
}

function addPagelenToPath(
  path: string,
  pagenlen: number = MAX_PAGELEN
): string {
  const resolvedURL = parseUrl(resolveBaseUrl(baseUrl, path));

  // istanbul ignore if
  if (is.nullOrUndefined(resolvedURL)) {
    return path;
  }

  resolvedURL.searchParams.set('pagelen', pagenlen.toString());

  return resolvedURL.toString();
}

function isPagedResult(obj: any): obj is PagedResult {
  return is.nonEmptyObject(obj) && Array.isArray(obj.values);
}

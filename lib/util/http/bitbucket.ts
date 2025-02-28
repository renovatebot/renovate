import is from '@sindresorhus/is';
import type { PagedResult } from '../../modules/platform/bitbucket/types';
import type { InternalJsonUnsafeOptions } from './http';
import type { HttpMethod, HttpOptions, HttpResponse } from './types';
import { Http } from '.';

const MAX_PAGES = 100;
const MAX_PAGELEN = 100;

let baseUrl = 'https://api.bitbucket.org/';

export function setBaseUrl(url: string): void {
  baseUrl = url;
}

export interface BitbucketHttpOptions extends HttpOptions {
  paginate?: boolean;
  pagelen?: number;
}

export class BitbucketHttp extends Http<BitbucketHttpOptions> {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(type = 'bitbucket', options?: BitbucketHttpOptions) {
    super(type, options);
  }

  protected override async requestJsonUnsafe<T>(
    method: HttpMethod,
    options: InternalJsonUnsafeOptions<BitbucketHttpOptions>,
  ): Promise<HttpResponse<T>> {
    const resolvedUrl = this.resolveUrl(options.url, options.httpOptions);
    const opts = { ...options, url: resolvedUrl };
    const paginate = opts.httpOptions?.paginate;

    if (paginate && !hasPagelen(resolvedUrl)) {
      const pagelen = opts.httpOptions!.pagelen ?? MAX_PAGELEN;
      resolvedUrl.searchParams.set('pagelen', pagelen.toString());
    }

    const result = await super.requestJsonUnsafe<T | PagedResult<T>>(
      method,
      opts,
    );

    if (paginate && isPagedResult(result.body)) {
      const resultBody = result.body;
      let nextURL = result.body.next;
      let page = 2;

      for (; nextURL && page <= MAX_PAGES; page++) {
        resolvedUrl.searchParams.set('page', page.toString());
        const nextResult = await super.requestJsonUnsafe<PagedResult<T>>(
          method,
          opts,
        );

        resultBody.values.push(...nextResult.body.values);
        nextURL = nextResult.body.next;
      }

      // Override other page-related attributes
      resultBody.pagelen = resultBody.values.length;
      resultBody.size =
        page <= MAX_PAGES
          ? resultBody.values.length
          : /* v8 ignore next */ undefined;
      resultBody.next =
        page <= MAX_PAGES ? nextURL : /* v8 ignore next */ undefined;
    }

    return result as HttpResponse<T>;
  }
}

function hasPagelen(url: URL): boolean {
  return !is.nullOrUndefined(url.searchParams.get('pagelen'));
}

function isPagedResult<T>(obj: any): obj is PagedResult<T> {
  return is.nonEmptyObject(obj) && Array.isArray(obj.values);
}

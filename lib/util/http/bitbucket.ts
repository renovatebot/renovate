import is from '@sindresorhus/is';
import type { PagedResult } from '../../modules/platform/bitbucket/types';
import { regEx } from '../regex';
import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from '.';

let baseUrl = 'https://api.bitbucket.org/';

export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export class BitbucketHttp extends Http {
  constructor(type = 'bitbucket', options?: HttpOptions) {
    super(type, options);
  }

  protected override request<T>(
    url: string | URL,
    options?: InternalHttpOptions
  ): Promise<HttpResponse<T>> {
    const opts = { baseUrl, ...options };
    return super.request<T>(url, opts);
  }

  async getUnpaginatedJson<T>(
    url: string,
    options?: HttpOptions
  ): Promise<T[]> {
    let apiUrl = url;
    const values: T[] = [];
    let isIterating = true;

    while (isIterating) {
      const response = (await this.getJson<PagedResult<T>>(apiUrl, options))
        .body;

      values.push(...response.values);

      if (is.nullOrUndefined(response.next)) {
        isIterating = false;
        continue;
      }

      const nextPage =
        regEx(/page=\w*/)
          .exec(response.next)
          ?.shift() ?? '';

      apiUrl = url.concat(`?${nextPage}`);
    }

    return values;
  }
}

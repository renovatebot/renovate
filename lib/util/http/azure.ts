import is from '@sindresorhus/is';
import { logger } from '../../logger';
import type { PagedResult } from '../../modules/platform/azure/types';
import { parseUrl } from '../url';
import type { HttpOptions, HttpRequestOptions, HttpResponse } from './types';
import { Http } from '.';

export class AzureHttp extends Http<HttpOptions> {
  constructor(type = 'azure', options?: HttpOptions) {
    super(type, options);
  }

  protected override async request<T>(
    url: string,
    options?: HttpOptions & HttpRequestOptions<T>
  ): Promise<HttpResponse<T>> {
    const opts = {
      ...options,
      throwHttpErrors: true,
    };

    const resolvedUrl = parseUrl(url);

    // istanbul ignore if: this should never happen
    if (is.nullOrUndefined(resolvedUrl)) {
      logger.error({ url }, 'Azure: cannot parse url');
      throw new Error(`Azure: cannot parse path ${url}`);
    }

    const result = await super.request<T>(resolvedUrl.toString(), opts);
    const continuationToken = result.headers['x-ms-continuationtoken']
      ? result.headers['x-ms-continuationtoken']
      : '';
    if (continuationToken && isPagedResult(result.body)) {
      resolvedUrl.searchParams.set('continuationToken', continuationToken);
      const nextResult = await this.request<PagedResult<T>>(
        resolvedUrl.toString(),
        options as HttpOptions
      );
      if (isPagedResult(result.body)) {
        result.body.value.push(...nextResult.body.value);
      }
    }
    return result;
  }
}

function isPagedResult(obj: any): obj is PagedResult {
  return is.nonEmptyObject(obj) && Array.isArray(obj.value);
}

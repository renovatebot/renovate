import is from '@sindresorhus/is';
import type { PagedResult } from '../../modules/platform/azure/types';
import type { InternalJsonUnsafeOptions } from './http';
import { HttpBase } from './http';
import type { HttpMethod, HttpOptions, HttpResponse } from './types';

const MAX_LIMIT = 100;

let baseUrl: string;
export function setBaseUrl(url: string): void {
  baseUrl = url;
}

export interface AzureHttpOptions extends HttpOptions {
  paginate?: boolean;
  limit?: number;
  pagelen?: number;
}

export class AzureHttp extends HttpBase<AzureHttpOptions> {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(type = 'azure', options?: AzureHttpOptions) {
    super(type, options);
  }

  protected override async requestJsonUnsafe<T>(
    method: HttpMethod,
    options: InternalJsonUnsafeOptions<AzureHttpOptions>,
  ): Promise<HttpResponse<T>> {
    const resolvedUrl = this.resolveUrl(options.url, options.httpOptions);

    const opts = {
      ...options,
      url: resolvedUrl,
      throwHttpErrors: true,
    };
    opts.httpOptions ??= {};

    const paginate = opts.httpOptions?.paginate;
    if (paginate) {
      const limit = opts.httpOptions.limit ?? MAX_LIMIT;
      resolvedUrl.searchParams.set('$top', limit.toString());
    }

    const result = await super.requestJsonUnsafe<T | PagedResult<T>>(
      method,
      opts,
    );

    if (paginate && isPagedResult(result.body)) {
      opts.httpOptions.memCache = false;

      const continuationToken = result.headers['x-ms-continuationtoken'];
      if (continuationToken) {
        const nextUrl = new URL(resolvedUrl.toString());
        nextUrl.searchParams.set('continuationToken', continuationToken);

        opts.url = nextUrl;

        const nextResult = await this.requestJsonUnsafe<PagedResult<T>>(
          method,
          opts,
        );

        if (is.array(nextResult.body.value)) {
          result.body.value.push(...nextResult.body.value);
        }
      }
    }
    return result as HttpResponse<T>;
  }
}

function isPagedResult(obj: unknown): obj is PagedResult {
  return is.nonEmptyObject(obj) && is.array(obj.value);
}

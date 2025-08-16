import is from '@sindresorhus/is';
import { HttpBase, type InternalJsonUnsafeOptions } from './http';
import type { HttpMethod, HttpOptions, HttpResponse } from './types';

let baseUrl: string;
export const setBaseUrl = (newBaseUrl: string): void => {
  baseUrl = newBaseUrl.replace(/\/*$/, '/'); // TODO #12875
};

export interface GiteaHttpOptions extends HttpOptions {
  paginate?: boolean;
}

function getPaginationContainer<T = unknown>(body: unknown): T[] | null {
  if (is.array(body) && body.length) {
    return body as T[];
  }

  if (is.plainObject(body) && is.array(body?.data) && body.data.length) {
    return body.data as T[];
  }

  return null;
}

export class GiteaHttp extends HttpBase<GiteaHttpOptions> {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(hostType?: string, options?: HttpOptions) {
    super(hostType ?? 'gitea', options);
  }

  protected override async requestJsonUnsafe<T = unknown>(
    method: HttpMethod,
    options: InternalJsonUnsafeOptions<GiteaHttpOptions>,
  ): Promise<HttpResponse<T>> {
    const resolvedUrl = this.resolveUrl(options.url, options.httpOptions);
    const opts = {
      ...options,
      url: resolvedUrl,
    };
    const res = await super.requestJsonUnsafe<T>(method, opts);
    const pc = getPaginationContainer<T>(res.body);
    if (opts.httpOptions?.paginate && pc) {
      delete opts.httpOptions.cacheProvider;
      opts.httpOptions.memCache = false;

      delete opts.httpOptions.paginate;
      const total = parseInt(res.headers['x-total-count'] as string);
      let nextPage = parseInt(resolvedUrl.searchParams.get('page') ?? '1');

      while (total && pc.length < total) {
        nextPage += 1;
        resolvedUrl.searchParams.set('page', nextPage.toString());

        const nextRes = await super.requestJsonUnsafe<T>(method, opts);
        const nextPc = getPaginationContainer<T>(nextRes.body);
        if (nextPc === null) {
          break;
        }

        pc.push(...nextPc);
      }
    }

    return res;
  }
}

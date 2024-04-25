import is from '@sindresorhus/is';
import { resolveBaseUrl } from '../url';
import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from '.';

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

function resolveUrl(path: string, base: string): URL {
  const resolvedUrlString = resolveBaseUrl(base, path);
  return new URL(resolvedUrlString);
}

export class GiteaHttp extends Http<GiteaHttpOptions> {
  constructor(hostType?: string, options?: HttpOptions) {
    super(hostType ?? 'gitea', options);
  }

  protected override async request<T>(
    path: string,
    options?: InternalHttpOptions & GiteaHttpOptions,
  ): Promise<HttpResponse<T>> {
    const resolvedUrl = resolveUrl(path, options?.baseUrl ?? baseUrl);
    const opts = {
      baseUrl,
      ...options,
    };
    const res = await super.request<T>(resolvedUrl, opts);
    const pc = getPaginationContainer<T>(res.body);
    if (opts.paginate && pc) {
      const total = parseInt(res.headers['x-total-count'] as string, 10);
      let nextPage = parseInt(resolvedUrl.searchParams.get('page') ?? '1', 10);

      while (total && pc.length < total) {
        nextPage += 1;
        resolvedUrl.searchParams.set('page', nextPage.toString());

        const nextRes = await super.request<T>(resolvedUrl.toString(), opts);
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

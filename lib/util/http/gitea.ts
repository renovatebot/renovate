import { PLATFORM_TYPE_GITEA } from '../../constants/platforms';
import { resolveBaseUrl } from '../url';
import { Http, HttpOptions, HttpResponse, InternalHttpOptions } from '.';

let baseUrl;
export const setBaseUrl = (newBaseUrl: string): void => {
  baseUrl = newBaseUrl.replace(/\/*$/, '/');
};

export interface GiteaHttpOptions extends InternalHttpOptions {
  paginate?: boolean;
  token?: string;
}

function getPaginationContainer(body: any): any[] {
  if (Array.isArray(body) && body.length) {
    return body;
  }
  if (Array.isArray(body?.data) && body.data.length) {
    return body.data;
  }

  return null;
}

function resolveUrl(path: string, base: string): URL {
  const resolvedUrlString = resolveBaseUrl(base, path);
  return new URL(resolvedUrlString);
}

export class GiteaHttp extends Http<GiteaHttpOptions, GiteaHttpOptions> {
  constructor(options?: HttpOptions) {
    super(PLATFORM_TYPE_GITEA, options);
  }

  protected async request<T>(
    path: string,
    options?: InternalHttpOptions & GiteaHttpOptions
  ): Promise<HttpResponse<T> | null> {
    const resolvedUrl = resolveUrl(path, options.baseUrl ?? baseUrl);
    const opts = {
      baseUrl,
      ...options,
    };
    const res = await super.request<T>(resolvedUrl, opts);
    const pc = getPaginationContainer(res.body);
    if (opts.paginate && pc) {
      const total = parseInt(res.headers['x-total-count'] as string, 10);
      let nextPage = parseInt(resolvedUrl.searchParams.get('page') || '1', 10);

      while (total && pc.length < total) {
        nextPage += 1;
        resolvedUrl.searchParams.set('page', nextPage.toString());

        const nextRes = await super.request<T>(resolvedUrl.toString(), opts);
        const nextPc = getPaginationContainer(nextRes.body);
        if (nextPc === null) {
          break;
        }

        pc.push(...nextPc);
      }
    }

    return res;
  }
}

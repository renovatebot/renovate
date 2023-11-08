import { resolveBaseUrl } from '../url';
import type {
  HttpOptions,
  HttpRequestOptions,
  HttpResponse,
  InternalHttpOptions,
} from './types';
import { Http } from '.';

let baseUrl: string;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export class BitbucketServerHttp extends Http {
  constructor(options?: HttpOptions) {
    super('bitbucket-server', options);
  }

  protected override request<T>(
    path: string,
    options?: InternalHttpOptions & HttpRequestOptions<T>,
  ): Promise<HttpResponse<T>> {
    const url = resolveBaseUrl(baseUrl, path);
    const opts = {
      baseUrl,
      ...options,
    };
    opts.headers = {
      ...opts.headers,
      'X-Atlassian-Token': 'no-check',
    };
    return super.request<T>(url, opts);
  }
}

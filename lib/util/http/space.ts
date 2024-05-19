import { isHttpUrl } from '../url';
import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from './index';

export class SpaceHttp extends Http {
  constructor(
    private baseUrl: string,
    options?: HttpOptions,
  ) {
    super('space', options);
  }

  protected override async request<T>(
    path: string,
    options?: InternalHttpOptions,
  ): Promise<HttpResponse<T>> {
    const url = isHttpUrl(path) ? path : this.baseUrl + path;
    const opts: InternalHttpOptions = {
      ...options,
    };
    opts.headers = {
      ...opts.headers,
    };
    return await super.request<T>(url, opts);
  }
}

import type { GotOptions, HttpResponse } from '../types';

export interface HttpCacheProvider {
  setCacheHeaders<T extends Pick<GotOptions, 'headers'>>(
    method: string,
    url: string,
    opts: T,
  ): Promise<void>;

  bypassServer<T>(
    method: string,
    url: string,
    ignoreSoftTtl?: boolean,
  ): Promise<HttpResponse<T> | null>;

  wrapServerResponse<T>(
    method: string,
    url: string,
    resp: HttpResponse<T>,
  ): Promise<HttpResponse<T>>;
}

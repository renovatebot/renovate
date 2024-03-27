import {validateUrl} from '../url';
import type {HttpOptions, HttpResponse, InternalHttpOptions} from './types';
import {Http} from './index';

let baseUrl: string;
export function setBaseUrl(url: string): void {
  baseUrl = url;
}

/**
 * Access Gerrit REST-API and strip-of the "magic prefix" from responses.
 * @see https://gerrit-review.googlesource.com/Documentation/rest-api.html
 */
export class SpaceHttp extends Http {
  constructor(options?: HttpOptions) {
    super('space', options);
  }

  protected override async request<T>(
    path: string,
    options?: InternalHttpOptions,
  ): Promise<HttpResponse<T>> {
    const url = validateUrl(path) ? path : baseUrl + path;
    const opts: InternalHttpOptions = {
      ...options,
    };
    opts.headers = {
      ...opts.headers,
    };
    return await super.request<T>(url, opts);
  }
}

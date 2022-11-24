import is from '@sindresorhus/is';
import JSON5 from 'json5';
import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from './index';

let baseUrl: string;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

/**
 * Access Gerrit REST-API and strip-of the "magic prefix" from responses.
 * @see https://gerrit-review.googlesource.com/Documentation/rest-api.html
 */
export class GerritHttp extends Http {
  magicPrefix = /^\)]}'\n/g;

  constructor(options?: HttpOptions) {
    super('gerrit', options);
  }

  protected override async request<T>(
    path: string,
    options?: InternalHttpOptions
  ): Promise<HttpResponse<T>> {
    const url = baseUrl + path;
    const opts = {
      baseUrl,
      ...options,
      responseType: undefined, //IMPORTANT: we need to remove "json" or it tries to parse the result immediately, which don't work cause the of the magicPrefix
    };
    opts.headers = {
      ...opts.headers,
    };
    const response = await super.request<T>(url, opts);
    if (
      response.headers['content-type']?.includes('application/json') &&
      is.string(response.body)
    ) {
      const newBody = JSON5.parse(
        response.body.replaceAll(this.magicPrefix, '')
      );
      return {
        ...response,
        body: newBody,
      };
    }
    return response;
  }
}

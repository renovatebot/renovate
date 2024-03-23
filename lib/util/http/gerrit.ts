import { parseJson } from '../common';
import { regEx } from '../regex';
import { validateUrl } from '../url';
import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from './index';

let baseUrl: string;
export function setBaseUrl(url: string): void {
  baseUrl = url;
}

/**
 * Access Gerrit REST-API and strip-of the "magic prefix" from responses.
 * @see https://gerrit-review.googlesource.com/Documentation/rest-api.html
 */
export class GerritHttp extends Http {
  private static magicPrefix = regEx(/^\)]}'\n/g);

  constructor(options?: HttpOptions) {
    super('gerrit', options);
  }

  protected override async request<T>(
    path: string,
    options?: InternalHttpOptions,
  ): Promise<HttpResponse<T>> {
    const url = validateUrl(path) ? path : baseUrl + path;
    const opts: InternalHttpOptions = {
      parseJson: (text: string) =>
        parseJson(text.replace(GerritHttp.magicPrefix, ''), path),
      ...options,
    };
    opts.headers = {
      ...opts.headers,
    };
    return await super.request<T>(url, opts);
  }
}

import { parseJson } from '../common.ts';
import { regEx } from '../regex.ts';
import { isHttpUrl } from '../url.ts';
import { HttpBase, type InternalHttpOptions } from './http.ts';
import type { HttpOptions } from './types.ts';

let baseUrl: string;
export function setBaseUrl(url: string): void {
  baseUrl = url;
}

/**
 * Access Gerrit REST-API and strip-of the "magic prefix" from responses.
 * @see https://gerrit-review.googlesource.com/Documentation/rest-api.html
 */
export class GerritHttp extends HttpBase {
  private static magicPrefix = regEx(/^\)]}'\n/g);

  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(options?: HttpOptions) {
    super('gerrit', options);
  }

  override resolveUrl(
    requestUrl: string | URL,
    options: HttpOptions | undefined = undefined,
  ): URL {
    // ensure trailing slash for gerrit
    return super.resolveUrl(
      isHttpUrl(requestUrl) ? requestUrl : `${baseUrl}${requestUrl}`,
      options,
    );
  }

  protected override processOptions(
    url: URL,
    options: InternalHttpOptions,
  ): void {
    options.parseJson = (text: string) =>
      parseJson(text.replace(GerritHttp.magicPrefix, ''), url.pathname);
  }
}

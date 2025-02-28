import { regEx } from '../regex';
import type { HttpOptions } from './types';
import { Http } from '.';

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

  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(options?: HttpOptions) {
    super('gerrit', options);
  }

  protected override prepareJsonBody(body: string): string {
    return body.replace(GerritHttp.magicPrefix, '');
  }
}

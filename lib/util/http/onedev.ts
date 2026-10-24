import { regEx } from '../regex.ts';
import { HttpBase } from './http.ts';
import type { HttpOptions } from './types.ts';

let baseUrl: string;

export function setBaseUrl(newBaseUrl: string): void {
  baseUrl = newBaseUrl.replace(regEx(/\/*$/), '/'); // TODO #12875
}

export class OnedevHttp extends HttpBase {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(hostType?: string, options?: HttpOptions) {
    super(hostType ?? 'onedev', options);
  }
}

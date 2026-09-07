import { regEx } from '../regex.ts';
import { GiteaHttp } from './gitea.ts';
import type { HttpOptions } from './types.ts';

let baseUrl: string;

export function setBaseUrl(newBaseUrl: string): void {
  baseUrl = newBaseUrl.replace(regEx(/\/*$/), '/'); // TODO #12875
}

export type { GiteaHttpOptions as ForgejoHttpOptions } from './gitea.ts';

/**
 * Forgejo is a fork of Gitea and shares its API, including the pagination
 * scheme, so only the default host type and the base URL differ.
 */
export class ForgejoHttp extends GiteaHttp {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(hostType?: string, options?: HttpOptions) {
    super(hostType ?? 'forgejo', options);
  }
}

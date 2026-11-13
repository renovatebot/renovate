import { regEx } from '../regex.ts';
import { GiteaHttp } from './gitea.ts';
import type { HttpOptions } from './types.ts';

let baseUrl: string;

export function setBaseUrl(newBaseUrl: string): void {
  baseUrl = newBaseUrl.replace(regEx(/\/*$/), '/'); // TODO #12875
}

/**
 * Forgejo speaks the Gitea API, so the client only differs in its default
 * `hostType` and in the base url, which is kept separate from Gitea's.
 */
export class ForgejoHttp extends GiteaHttp {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(hostType?: string, options?: HttpOptions) {
    super(hostType ?? 'forgejo', options);
  }
}

import type { HttpOptions } from './types';
import { Http } from '.';

let baseUrl: string;

export function setBaseUrl(url: string): void {
  baseUrl = url;
}

export class JiraHttp extends Http {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(type = 'jira', options?: HttpOptions) {
    super(type, options);
  }
}

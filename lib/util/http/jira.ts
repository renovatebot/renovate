import { HttpBase } from './http';
import type { HttpOptions } from './types';

let baseUrl: string;

export function setBaseUrl(url: string): void {
  baseUrl = url;
}

export class JiraHttp extends HttpBase {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(type = 'jira', options?: HttpOptions) {
    super(type, options);
  }
}

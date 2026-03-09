import { ensureTrailingSlash } from '../url.ts';
import { HttpBase } from './http.ts';

let baseUrl: string;
export const setBaseUrl = (newBaseUrl: string): void => {
  baseUrl = ensureTrailingSlash(newBaseUrl);
};
export const getBaseUrl = (): string => baseUrl;

export class ScmManagerHttp extends HttpBase {
  constructor() {
    super('scm-manager');
  }

  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }
}

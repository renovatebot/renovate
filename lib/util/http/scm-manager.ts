import { ensureTrailingSlash } from '../url';
import { HttpBase } from './http';

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

import { HttpBase, type InternalJsonUnsafeOptions } from './http';
import type { HttpMethod, HttpOptions, HttpResponse } from './types';

let baseUrl: string;
export const setBaseUrl = (newBaseUrl: string): void => {
  baseUrl = newBaseUrl.replace(/\/*$/, '/');
};
export const getBaseUrl = (): string => baseUrl;

export interface ScmManagerHttpOptions extends HttpOptions {
  scmmContentType?: string;
}

export class ScmManagerHttp extends HttpBase<ScmManagerHttpOptions> {
  constructor() {
    super('scm-manager');
  }

  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  protected override async requestJsonUnsafe<T = unknown>(
    method: HttpMethod,
    options: InternalJsonUnsafeOptions<ScmManagerHttpOptions>,
  ): Promise<HttpResponse<T>> {
    const customOptions = {
      ...options,
      httpOptions: {
        ...options.httpOptions,
        headers: {
          ...options.httpOptions?.headers,
          accept: options.httpOptions?.scmmContentType,
        },
      },
    };

    return await super.requestJsonUnsafe<T>(method, customOptions);
  }
}

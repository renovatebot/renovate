import JSON5 from 'json5';
import { ZodSchema } from 'zod';
import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from './index';

let baseUrl: string;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

/**
 * Access Gerrit REST-API and strip-of the "magic prefix" from responses.
 * @see https://gerrit-review.googlesource.com/Documentation/rest-api.html
 */
export class GerritHttp extends Http {
  magicPrefix = /^\)]}'\n/g;

  constructor(options?: HttpOptions) {
    super('gerrit', options);
  }

  protected override request<T>(
    path: string,
    options?: InternalHttpOptions
  ): Promise<HttpResponse<T>> {
    const url = baseUrl + path;
    const opts = {
      baseUrl,
      ...options,
    };
    opts.headers = {
      ...opts.headers,
    };
    return super.request<T>(url, opts);
  }

  override get(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return super.get(url, options).then((res) => ({
      ...res,
      body: res.body.replaceAll(this.magicPrefix, ''),
    }));
  }

  override getJson<T = any>(
    url: string,
    options?: HttpOptions | ZodSchema,
    arg3?: ZodSchema
  ): Promise<HttpResponse<T>> {
    // istanbul ignore next
    const httpOptions = options instanceof ZodSchema ? undefined : options;
    return super.get(url, httpOptions).then((res) => ({
      ...res,
      body: JSON5.parse(res.body.replaceAll(this.magicPrefix, '')),
    }));
  }

  //TODO: ugly and broken for ZodSchema usage
  override async postJson<T = unknown>(
    url: string,
    options?: HttpOptions | ZodSchema
  ): Promise<HttpResponse<T>> {
    // istanbul ignore next
    const body =
      options instanceof ZodSchema ? undefined : JSON5.stringify(options?.body);
    const res = await this.request<string>(url, {
      ...options,
      method: 'post',
      body,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
      },
    });
    return {
      ...res,
      body: JSON5.parse(res.body.replaceAll(this.magicPrefix, '')),
    };
  }

  //TODO: ugly and broken for ZodSchema usage
  override async putJson<T = unknown>(
    url: string,
    options?: HttpOptions | ZodSchema
  ): Promise<HttpResponse<T>> {
    // istanbul ignore next
    const body =
      options instanceof ZodSchema ? undefined : JSON5.stringify(options?.body);
    const res = await this.request<string>(url, {
      ...options,
      method: 'put',
      body,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
      },
    });
    return {
      ...res,
      body: JSON5.parse(res.body.replaceAll(this.magicPrefix, '')),
    };
  }
}

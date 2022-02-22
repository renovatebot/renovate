import type { IncomingHttpHeaders } from 'http';
import {
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
  RequestError as RequestError_,
} from 'got';

export type GotContextOptions = {
  authType?: string;
} & Record<string, unknown>;

// TODO: Move options to context
export type GotOptions = GotBufferOptions | GotJSONOptions;
export type GotBufferOptions = OptionsOfBufferResponseBody & GotExtraOptions;
export type GotJSONOptions = OptionsOfJSONResponseBody & GotExtraOptions;

export { RequestError_ as HttpError };

export type GotExtraOptions = {
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  token?: string;
  hostType?: string;
  enabled?: boolean;
  useCache?: boolean;
  noAuth?: boolean;
  context?: GotContextOptions;
};

export interface RequestStats {
  method: string;
  url: string;
  duration: number;
  queueDuration: number;
}

export type OutgoingHttpHeaders = Record<string, string | string[] | undefined>;

export interface HttpOptions {
  body?: any;
  username?: string;
  password?: string;
  baseUrl?: string;
  headers?: OutgoingHttpHeaders;

  /**
   * Do not use authentication
   */
  noAuth?: boolean;

  throwHttpErrors?: boolean;
  useCache?: boolean;
}

export interface HttpPostOptions extends HttpOptions {
  body: unknown;
}

export interface InternalHttpOptions extends HttpOptions {
  json?: Record<string, unknown>;
  responseType?: 'json' | 'buffer';
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';
}

export interface HttpHeaders extends IncomingHttpHeaders {
  link?: string | undefined;
}

export interface HttpResponse<T = string> {
  statusCode: number;
  body: T;
  headers: HttpHeaders;
  authorization?: boolean;
}

import type { IncomingHttpHeaders } from 'node:http';
import type {
  Options,
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
  OptionsOfTextResponseBody,
  RequestError,
} from 'got';
import type { ZodError } from 'zod';
import type { HttpCacheProvider } from './cache/types';
import type { EmptyResultError } from './errors';

export type GotContextOptions = {
  authType?: string;
} & Record<string, unknown>;

// TODO: Move options to context
export type GotOptions = GotBufferOptions | GotTextOptions | GotJSONOptions;
export type GotBufferOptions = OptionsOfBufferResponseBody & GotExtraOptions;
export type GotTextOptions = OptionsOfTextResponseBody & GotExtraOptions;
export type GotJSONOptions = OptionsOfJSONResponseBody & GotExtraOptions;

export type GotStreamOptions = Options & GotExtraOptions;

export interface GotExtraOptions {
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  token?: string;
  hostType?: string;
  enabled?: boolean;
  memCache?: boolean;
  noAuth?: boolean;
  context?: GotContextOptions;
}

export type OutgoingHttpHeaders = Record<string, string | string[] | undefined>;

export type GraphqlVariables = Record<string, unknown>;

export interface GraphqlOptions {
  variables?: GraphqlVariables;
  paginate?: boolean;
  count?: number;
  limit?: number;
  cursor?: string | null;
  acceptHeader?: string;
  token?: string;
  readOnly?: boolean;
}

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

  token?: string;
  memCache?: boolean;
  cacheProvider?: HttpCacheProvider;
  readOnly?: boolean;
}

export interface HttpHeaders extends IncomingHttpHeaders {
  link?: string | undefined;
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';

export interface HttpResponse<T = string> {
  statusCode: number;
  body: T;
  headers: HttpHeaders;
  authorization?: boolean;
}

export type Task<T> = () => Promise<T>;
export type GotTask<T = unknown> = Task<HttpResponse<T>>;

export interface ThrottleLimitRule {
  matchHost: string;
  throttleMs: number;
}

export interface ConcurrencyLimitRule {
  matchHost: string;
  concurrency: number;
}

export type SafeJsonError = RequestError | ZodError | EmptyResultError;

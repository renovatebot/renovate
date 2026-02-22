import type { IncomingHttpHeaders } from 'node:http';
import type {
  OptionsInit,
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
  OptionsOfTextResponseBody,
  RequestError,
} from 'got';
import type { ZodError } from 'zod/v3';
import type { HttpCacheProvider } from './cache/types.ts';
import type { EmptyResultError } from './errors.ts';

export type GotContextOptions = {
  authType?: string;
} & Record<string, unknown>;

// TODO: Move options to context
export type GotOptions = GotBufferOptions | GotTextOptions | GotJSONOptions;
export type GotBufferOptions = OptionsOfBufferResponseBody & GotExtraOptions;
export type GotTextOptions = OptionsOfTextResponseBody & GotExtraOptions;
export type GotJSONOptions = OptionsOfJSONResponseBody & GotExtraOptions;

export type GotStreamOptions = OptionsInit & GotExtraOptions;

/**
 * Renovate extra options.
 */
export interface GotExtraOptions {
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];

  token?: string;
  hostType?: string;
  enabled?: boolean;
  memCache?: boolean;
  noAuth?: boolean;
  context?: GotContextOptions;

  /**
   * Got request timeout, overrides got interface.
   * Do not delete in `normalizeGotOptions`.
   */
  timeout?: number;
}

/**
 * Renovate extra options that are not part of `got` options.
 */
export const GotExtraOptionKeys: (keyof GotExtraOptions)[] = [
  'abortOnError',
  'abortIgnoreStatusCodes',
  'enabled',
  'hostType',
  'memCache',
  'noAuth',
  'token',
];

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

/**
 * Renovate http options that are partly not part of `got` options.
 * Remember to delete these in `normalizeGotOptions` before passing to `got`.
 */
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
  cached?: boolean;
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

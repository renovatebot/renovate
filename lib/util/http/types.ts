import type { IncomingHttpHeaders } from 'http';
import type {
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
} from 'got';

export type GotContextOptions = {
  authType?: string;
} & Record<string, unknown>;

// TODO: Move options to context
export type GotOptions = GotBufferOptions | GotJSONOptions;
export type GotBufferOptions = OptionsOfBufferResponseBody & GotExtraOptions;
export type GotJSONOptions = OptionsOfJSONResponseBody & GotExtraOptions;

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
  statusCode: number;
}

export type OutgoingHttpHeaders = Record<string, string | string[] | undefined>;

export interface GraphqlVariables {
  [k: string]: unknown;
}

export interface GraphqlOptions {
  variables?: GraphqlVariables;
  paginate?: boolean;
  count?: number;
  limit?: number;
  cursor?: string | null;
  acceptHeader?: string;
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
  useCache?: boolean;

  onSchemaError?: 'warn' | 'throw';
}

export interface InternalHttpOptions extends HttpOptions {
  json?: HttpOptions['body'];
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

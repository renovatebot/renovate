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

export { RequestError_ as HttpError };

export interface RequestStats {
  method: string;
  url: string;
  duration: number;
  queueDuration: number;
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

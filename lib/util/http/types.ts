import { OptionsOfJSONResponseBody, RequestError as RequestError_ } from 'got';

export type GotContextOptions = {
  authType?: string;
} & Record<string, unknown>;

// TODO: Move options to context
export type GotOptions = OptionsOfJSONResponseBody & {
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  token?: string;
  hostType?: string;
  enabled?: boolean;
  useCache?: boolean;
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

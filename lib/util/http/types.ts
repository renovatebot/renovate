import { OptionsOfJSONResponseBody, RequestError as RequestError_ } from 'got';

// TODO: Move options to context
export type GotOptions = OptionsOfJSONResponseBody & {
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  token?: string;
  hostType?: string;
  enabled?: boolean;
  useCache?: boolean;
};

export { RequestError_ as HttpError };

export interface RequestStats {
  method: string;
  url: string;
  duration: number;
  queueDuration: number;
}

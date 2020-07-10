import { OptionsOfJSONResponseBody } from 'got';

// TODO: move to context
export type GotOptions = OptionsOfJSONResponseBody & {
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  token?: string;
  hostType?: string;
  enabled?: boolean;
  useCache?: boolean;
};

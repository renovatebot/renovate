import { NormalizedOptions, Options, Response as _Response } from 'got';
import { Merge } from 'type-fest';

export type GotResponse<T> = _Response<T>;

export type GotHeaders = Record<string, string | string[]>;

export type RenovateGotOptions = Merge<
  NormalizedOptions,
  {
    context: ContextOptions;
  }
>;

export type ContextOptions = {
  token?: string;
  hostType?: string;
  useCache?: boolean;
};

export type GotOptions = Merge<
  Options,
  {
    context?: ContextOptions;
  }
>;

export type GotJSONOptions = Merge<
  GotOptions,
  {
    responseType: 'json';
  }
>;

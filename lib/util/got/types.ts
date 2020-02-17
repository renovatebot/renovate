import {
  NormalizedOptions,
  Options,
  Response as _Response,
  GotError,
} from 'got';
import { Merge } from 'type-fest';

// TODO: remove when code is refactord
Object.defineProperty(GotError.prototype, 'statusCode', {
  get: function statusCode() {
    return this.response?.statusCode;
  },
});

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
    readableHighWaterMark?: number;
  }
>;

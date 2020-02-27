import {
  NormalizedOptions,
  Headers,
  Options,
  Response as _Response,
  GotError,
  Method,
} from 'got';
import { Merge } from 'type-fest';

// TODO: remove when code is refactord
Object.defineProperty(GotError.prototype, 'statusCode', {
  get: function statusCode() {
    return this.response?.statusCode;
  },
});
Object.defineProperty(GotError.prototype, 'code', {
  get: function code() {
    return this.response?.code;
  },
});

export type GotResponse<T> = _Response<T>;

export type GotMethod = Method;

export type GotHeaders = Headers;

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

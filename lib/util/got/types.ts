import {
  NormalizedOptions,
  Headers,
  Options,
  Response as _Response,
  GotError,
  Method,
  ExtendOptions,
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
    return this._code ?? this.response?.code;
  },
  set: function code(v) {
    this._code = v;
  },
});

export type GotResponse<T> = _Response<T>;

export type GotMethod = Method;

export type GotHeaders = Headers;

export type RenovateGotContext = {
  token?: string;
  hostType?: string;
  useCache?: boolean;
};

export type RenovateGotInitOptions = Merge<
  ExtendOptions,
  {
    context?: RenovateGotContext;
  }
>;

export type RenovateGotHandlerOptions = Merge<
  NormalizedOptions,
  {
    context: RenovateGotContext;
  }
>;

export type GotOptions = Merge<
  Options,
  {
    context?: RenovateGotContext;
  }
>;

export type GotJSONOptions = Merge<
  GotOptions,
  {
    responseType: 'json';
    readableHighWaterMark?: number;
  }
>;

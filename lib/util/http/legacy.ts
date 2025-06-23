import { RequestError as HttpError } from 'got';
import { parseUrl } from '../url';

// TODO: remove when code is refactored (#9651)

Object.defineProperty(HttpError.prototype, 'statusCode', {
  get: function statusCode(this: HttpError) {
    return this.response?.statusCode;
  },
  configurable: true, // required by azure tests
});

Object.defineProperty(HttpError.prototype, 'body', {
  get: function body(this: HttpError): unknown {
    return this.response?.body;
  },
  set: function body(this: HttpError, value: unknown): void {
    if (this.response) {
      this.response.body = value;
    }
  },
  configurable: true,
});

Object.defineProperty(HttpError.prototype, 'headers', {
  get: function headers(this: HttpError) {
    return this.response?.headers;
  },
});

Object.defineProperty(HttpError.prototype, 'url', {
  get: function url(this: HttpError) {
    return this.response?.url;
  },
  configurable: true,
});

Object.defineProperty(HttpError.prototype, 'host', {
  get: function url(this: HttpError) {
    const urlStr = this.response?.url;
    const url = urlStr ? parseUrl(urlStr) : null;
    return url?.host;
  },
  configurable: true,
});

export type GotLegacyError<E = unknown, T = unknown> = HttpError & {
  statusCode?: number;
  body: {
    message?: string;
    errors?: E[];
  };
  headers?: Record<string, T>;
};

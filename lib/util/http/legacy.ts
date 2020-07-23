// istanbul ignore file
import { HttpError } from './types';

// TODO: remove when code is refactord

Object.defineProperty(HttpError.prototype, 'statusCode', {
  get: function statusCode(this: HttpError) {
    return this.response?.statusCode;
  },
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
});

Object.defineProperty(HttpError.prototype, 'headers', {
  get: function headers(this: HttpError) {
    return this.response?.headers;
  },
});

export type GotLegacyError<E = unknown, T = unknown> = HttpError & {
  statusCode?: number;
  body: {
    message?: string;
    errors?: E[];
  };
  headers?: Record<string, T>;
};

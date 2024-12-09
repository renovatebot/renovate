import type Request from 'got/dist/source/core';
import { partial } from '../../../../test/util';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { Http, HttpError } from '../../../util/http';
import type { MavenFetchError } from './types';
import {
  checkResource,
  downloadHttpProtocol,
  downloadMavenXml,
  downloadS3Protocol,
} from './util';

const http = new Http('test');

function httpError({
  name,
  message = 'unknown error',
  code,
  request = {},
  response,
}: {
  name?: string;
  message?: string;
  code?: HttpError['code'];
  request?: Partial<Request>;
  response?: Partial<Response>;
}): HttpError {
  type Writeable<T> = { -readonly [P in keyof T]: T[P] };

  const err = new HttpError(
    message,
    { code },
    request as never,
  ) as Writeable<HttpError>;

  if (name) {
    err.name = name;
  }

  if (response) {
    err.response = response as never;
  }

  return err;
}

describe('modules/datasource/maven/util', () => {
  describe('downloadMavenXml', () => {
    it('returns empty object for unsupported protocols', async () => {
      const res = await downloadMavenXml(
        http,
        new URL('unsupported://server.com/'),
      );
      expect(res).toEqual({});
    });
  });

  describe('downloadS3Protocol', () => {
    it('fails for non-S3 URLs', async () => {
      const res = await downloadS3Protocol(new URL('http://not-s3.com/'));
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'invalid-url' } satisfies MavenFetchError,
      });
    });
  });

  describe('downloadHttpProtocol', () => {
    it('returns empty for HOST_DISABLED error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject(httpError({ message: HOST_DISABLED })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'host-disabled' } satisfies MavenFetchError,
      });
    });

    it('returns empty for host error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject(httpError({ code: 'ETIMEDOUT' })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'host-error' } satisfies MavenFetchError,
      });
    });

    it('returns empty for temporary error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject(httpError({ code: 'ECONNRESET' })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'temporary-error' } satisfies MavenFetchError,
      });
    });

    it('returns empty for connection error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject(httpError({ code: 'ECONNREFUSED' })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'connection-error' } satisfies MavenFetchError,
      });
    });

    it('returns empty for unsupported error', async () => {
      const http = partial<Http>({
        get: () =>
          Promise.reject(httpError({ name: 'UnsupportedProtocolError' })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'unsupported-host' } satisfies MavenFetchError,
      });
    });
  });

  describe('checkResource', () => {
    it('returns not found for unsupported protocols', async () => {
      const res = await checkResource(http, 'unsupported://server.com/');
      expect(res).toBe('not-found');
    });

    it('returns error for invalid URLs', async () => {
      const res = await checkResource(http, 'not-a-valid-url');
      expect(res).toBe('error');
    });
  });
});

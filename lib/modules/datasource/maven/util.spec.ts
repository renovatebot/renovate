import type Request from 'got/dist/source/core';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { Http, HttpError } from '../../../util/http';
import type { MavenFetchError } from './types';
import {
  downloadHttpProtocol,
  downloadMavenXml,
  downloadS3Protocol,
} from './util';
import { partial } from '~test/util';

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
    it('returns error for unsupported protocols', async () => {
      const res = await downloadMavenXml(
        http,
        new URL('unsupported://server.com/'),
      );
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'unsupported-protocol' } satisfies MavenFetchError,
      });
    });

    it('returns error for xml parse error', async () => {
      const http = partial<Http>({
        getText: () =>
          Promise.resolve({
            statusCode: 200,
            body: 'invalid xml',
            headers: {},
          }),
      });
      const res = await downloadMavenXml(http, new URL('https://example.com/'));
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'xml-parse-error', err: expect.any(Error) },
      });
    });
  });

  describe('downloadS3Protocol', () => {
    it('returns error for non-S3 URLs', async () => {
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
        getText: () => Promise.reject(httpError({ message: HOST_DISABLED })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'host-disabled' } satisfies MavenFetchError,
      });
    });

    it('returns empty for host error', async () => {
      const http = partial<Http>({
        getText: () => Promise.reject(httpError({ code: 'ETIMEDOUT' })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'host-error' } satisfies MavenFetchError,
      });
    });

    it('returns empty for temporary error', async () => {
      const http = partial<Http>({
        getText: () => Promise.reject(httpError({ code: 'ECONNRESET' })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'temporary-error' } satisfies MavenFetchError,
      });
    });

    it('returns empty for connection error', async () => {
      const http = partial<Http>({
        getText: () => Promise.reject(httpError({ code: 'ECONNREFUSED' })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'connection-error' } satisfies MavenFetchError,
      });
    });

    it('returns empty for unsupported error', async () => {
      const http = partial<Http>({
        getText: () =>
          Promise.reject(httpError({ name: 'UnsupportedProtocolError' })),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'unsupported-host' } satisfies MavenFetchError,
      });
    });
  });
});

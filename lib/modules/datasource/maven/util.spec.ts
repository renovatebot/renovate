import type Request from 'got/dist/source/core';
import { vi } from 'vitest';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as packageCache from '../../../util/cache/package';
import { Http, HttpError } from '../../../util/http';
import { MAVEN_REPO } from './common';
import type { MavenFetchError } from './types';
import {
  downloadHttpProtocol,
  downloadMavenXml,
  downloadS3Protocol,
} from './util';
import { logger, partial } from '~test/util';

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
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.any(Object),
        'Temporary error',
      );
    });

    describe('429 logging', () => {
      const getCacheTypeSpy = vi.spyOn(packageCache, 'getCacheType');

      afterAll(() => {
        getCacheTypeSpy.mockRestore();
      });

      it('throws ExternalHostError for 429 status with redis cache', async () => {
        getCacheTypeSpy.mockReturnValue('redis');
        const http = partial<Http>({
          getText: () =>
            Promise.reject(
              httpError({
                code: 'ECONNRESET',
                response: { statusCode: 429 } as never,
              }),
            ),
        });
        await expect(
          downloadHttpProtocol(http, MAVEN_REPO + '/some/path'),
        ).rejects.toThrow(ExternalHostError);
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { failedUrl: MAVEN_REPO + '/some/path' },
          'Maven Central rate limiting detected despite Redis caching.',
        );
      });

      it('throws ExternalHostError for 429 status without redis cache', async () => {
        getCacheTypeSpy.mockReturnValue('file');
        const http = partial<Http>({
          getText: () =>
            Promise.reject(
              httpError({
                code: 'ECONNRESET',
                response: { statusCode: 429 } as never,
              }),
            ),
        });
        await expect(
          downloadHttpProtocol(http, MAVEN_REPO + '/some/path'),
        ).rejects.toThrow(ExternalHostError);
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { failedUrl: MAVEN_REPO + '/some/path' },
          'Maven Central rate limiting detected. Persistent caching required.',
        );
      });

      it('throws ExternalHostError for non-429 temporary error on maven central', async () => {
        const http = partial<Http>({
          getText: () => Promise.reject(httpError({ code: 'ECONNRESET' })),
        });
        await expect(
          downloadHttpProtocol(http, MAVEN_REPO + '/some/path'),
        ).rejects.toThrow(ExternalHostError);
        expect(logger.logger.debug).toHaveBeenCalledWith(
          { failedUrl: MAVEN_REPO + '/some/path', err: expect.any(HttpError) },
          'Temporary error',
        );
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

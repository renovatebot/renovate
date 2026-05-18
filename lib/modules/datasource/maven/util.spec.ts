import { vi } from 'vitest';
import { logger, partial } from '~test/util.ts';
import { HOST_DISABLED } from '../../../constants/error-messages.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { Http, HttpError } from '../../../util/http/index.ts';
import { parseUrl } from '../../../util/url.ts';
import { MAVEN_REPO } from './common.ts';
import type { MavenFetchError } from './types.ts';
import {
  downloadHttpContent,
  downloadHttpProtocol,
  downloadMavenXml,
  downloadS3Protocol,
} from './util.ts';

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
  request?: Record<string, unknown>;
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
        parseUrl('unsupported://server.com/')!,
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
      const res = await downloadMavenXml(
        http,
        parseUrl('https://example.com/')!,
      );
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'xml-parse-error', err: expect.any(Error) },
      });
    });
  });

  describe('downloadHttpContent', () => {
    it('returns the downloaded text body', async () => {
      const http = partial<Http>({
        getText: () =>
          Promise.resolve({
            statusCode: 200,
            body: 'pom text',
            headers: {},
          }),
      });

      await expect(
        downloadHttpContent(http, 'https://example.com/'),
      ).resolves.toBe('pom text');
    });
  });

  describe('downloadS3Protocol', () => {
    it('returns error for non-S3 URLs', async () => {
      const res = await downloadS3Protocol(parseUrl('http://not-s3.com/')!);
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'invalid-url' } satisfies MavenFetchError,
      });
    });
  });

  describe('cache provider selection', () => {
    const mockResponse = {
      statusCode: 200 as const,
      body: '<xml/>',
      headers: {},
    };

    it.each([
      [
        'release POM',
        'https://repo.maven.apache.org/maven2/com/example/lib/1.0.0/lib-1.0.0.pom',
        'datasource-maven:pom-cache-provider',
      ],
      [
        'timestamped snapshot POM',
        'https://repo.maven.apache.org/maven2/com/example/lib/1.0.0-SNAPSHOT/lib-1.0.0-20250101.120000-42.pom',
        'datasource-maven:pom-cache-provider',
      ],
      [
        'non-timestamped snapshot POM',
        'https://repo.maven.apache.org/maven2/com/example/lib/1.0.0-SNAPSHOT/lib-1.0.0-SNAPSHOT.pom',
        'datasource-maven:cache-provider',
      ],
      [
        'release metadata',
        'https://repo.maven.apache.org/maven2/com/example/lib/maven-metadata.xml',
        'datasource-maven:cache-provider',
      ],
      [
        'snapshot metadata',
        'https://repo.maven.apache.org/maven2/com/example/lib/1.0.0-SNAPSHOT/maven-metadata.xml',
        'datasource-maven:cache-provider',
      ],
    ])(
      'uses correct cache provider for %s',
      async (_label, url, expectedNamespace) => {
        let capturedCacheProvider: Record<string, unknown> | undefined;
        const http = partial<Http>({
          getText: (_url, opts) => {
            capturedCacheProvider = opts?.cacheProvider as unknown as Record<
              string,
              unknown
            >;
            return Promise.resolve(mockResponse);
          },
        });

        await downloadHttpProtocol(http, url);

        expect(capturedCacheProvider).toMatchObject({
          namespace: expectedNamespace,
        });
      },
    );
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

    describe('maven-metadata.xml 404 caching', () => {
      const metadataUrl =
        'https://repo.maven.apache.org/maven2/com/example/lib/maven-metadata.xml';
      const nonMetadataUrl =
        'https://repo.maven.apache.org/maven2/com/example/lib/1.0.0/lib-1.0.0.pom';

      it('caches 404 for maven-metadata.xml URLs', async () => {
        const setSpy = vi
          .spyOn(packageCache, 'set')
          .mockResolvedValue(undefined);
        vi.spyOn(packageCache, 'get').mockResolvedValue(null);
        const http = partial<Http>({
          getText: () =>
            Promise.reject(
              httpError({ response: { statusCode: 404 } as never }),
            ),
        });

        const res = await downloadHttpProtocol(http, metadataUrl);

        expect(res.unwrap()).toEqual({
          ok: false,
          err: { type: 'not-found' } satisfies MavenFetchError,
        });
        expect(setSpy).toHaveBeenCalledWith(
          'datasource-maven:metadata-not-found',
          metadataUrl,
          true,
          expect.toBeNumber(),
        );
      });

      it('does not cache 404 for non-metadata URLs', async () => {
        const setSpy = vi
          .spyOn(packageCache, 'set')
          .mockResolvedValue(undefined);
        const http = partial<Http>({
          getText: () =>
            Promise.reject(
              httpError({ response: { statusCode: 404 } as never }),
            ),
        });

        await downloadHttpProtocol(http, nonMetadataUrl);

        expect(setSpy).not.toHaveBeenCalled();
      });

      it('returns cached not-found without making HTTP request', async () => {
        vi.spyOn(packageCache, 'get').mockResolvedValue(true);
        const getText = vi.fn();
        const http = partial<Http>({ getText });

        const res = await downloadHttpProtocol(http, metadataUrl);

        expect(res.unwrap()).toEqual({
          ok: false,
          err: { type: 'not-found' } satisfies MavenFetchError,
        });
        expect(getText).not.toHaveBeenCalled();
      });
    });
  });
});

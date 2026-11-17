import { vi } from 'vitest';
import * as httpMock from '~test/http-mock.ts';
import { logger, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { HOST_DISABLED } from '../../../constants/error-messages.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { Http, HttpError } from '../../../util/http/index.ts';
import { parseUrl } from '../../../util/url.ts';
import { MAVEN_CENTRAL_MIRROR, MAVEN_REPO } from './common.ts';
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
  response?: Partial<NonNullable<HttpError['response']>>;
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
    err.response = response as HttpError['response'];
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
    it.each`
      registryUrl                                       | authorization | isCacheable
      ${MAVEN_REPO}                                     | ${false}      | ${true}
      ${MAVEN_REPO}                                     | ${true}       | ${false}
      ${'https://clojars.org/repo'}                     | ${false}      | ${true}
      ${MAVEN_CENTRAL_MIRROR}                           | ${false}      | ${true}
      ${MAVEN_CENTRAL_MIRROR}                           | ${true}       | ${false}
      ${'https://repo1.maven.org.evil/maven2'}          | ${false}      | ${false}
      ${'https://REPO.Maven.Apache.org/maven2'}         | ${false}      | ${true}
      ${'https://repo.maven.apache.org:443/maven2'}     | ${false}      | ${true}
      ${'not-a-url'}                                    | ${false}      | ${false}
      ${'https://custom.registry.renovatebot.com'}      | ${false}      | ${false}
      ${'https://repo.maven.apache.org.evil/maven2'}    | ${false}      | ${false}
      ${'https://repo.maven.apache.org/maven2-private'} | ${false}      | ${false}
    `(
      'returns isCacheable=$isCacheable for $registryUrl with authorization=$authorization',
      async ({ registryUrl, authorization, isCacheable }) => {
        const http = partial<Http>({
          getText: () =>
            Promise.resolve({
              statusCode: 200,
              body: 'pom text',
              headers: {},
              authorization,
            }),
        });

        const res = await downloadHttpProtocol(
          http,
          `${registryUrl}/org/example/package/1.0.0/package-1.0.0.pom`,
        );

        expect(res.unwrap()).toEqual({
          ok: true,
          val: { data: 'pom text', isCacheable },
        });
      },
    );

    describe('with urlReplacements', () => {
      const pomUrl =
        'https://repo.maven.apache.org/maven2/org/example/foo/1.0.0/foo-1.0.0.pom';

      afterEach(() => {
        GlobalConfig.reset();
      });

      it.each`
        mirrorToken  | host
        ${undefined} | ${'https://mirror.example.com/maven-public'}
        ${'secret'}  | ${'https://repo.maven.apache.org/maven2'}
      `(
        'requests $host as cacheable for a mirror token $mirrorToken',
        async ({ mirrorToken, host }) => {
          GlobalConfig.set({
            urlReplacements: [
              {
                matchUrlPrefix: 'https://repo.maven.apache.org/maven2/',
                replaceUrlPrefix: 'https://mirror.example.com/maven-public/',
              },
            ],
          });
          hostRules.add({
            matchHost: 'mirror.example.com',
            token: mirrorToken,
          });
          httpMock
            .scope(host)
            .get('/org/example/foo/1.0.0/foo-1.0.0.pom')
            .reply(200, '<project/>');

          const res = await downloadHttpProtocol(new Http('maven'), pomUrl);

          expect(res.unwrap()).toEqual({
            ok: true,
            val: { data: '<project/>', isCacheable: true },
          });
        },
      );

      describe('error logs', () => {
        const mirrorPomUrl =
          'https://mirror.example.com/maven-public/org/example/foo/1.0.0/foo-1.0.0.pom';

        beforeEach(() => {
          GlobalConfig.set({
            urlReplacements: [
              {
                matchUrlPrefix: 'https://repo.maven.apache.org/maven2/',
                replaceUrlPrefix: 'https://mirror.example.com/maven-public/',
              },
            ],
          });
        });

        it('logs the mirror url when the mirror rejects the request', async () => {
          httpMock
            .scope('https://mirror.example.com')
            .get('/maven-public/org/example/foo/1.0.0/foo-1.0.0.pom')
            .reply(401);

          const res = await downloadHttpProtocol(new Http('maven'), pomUrl);

          expect(res.unwrap()).toEqual({
            ok: false,
            err: { type: 'permission-issue' } satisfies MavenFetchError,
          });
          expect(logger.logger.debug).toHaveBeenCalledWith(
            { failedUrl: mirrorPomUrl, mirror: true },
            'Dependency lookup unauthorized by the urlReplacements mirror',
          );
          expect(logger.logger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining('Please add authentication'),
          );
        });

        it('logs the original url when the requested url is unknown', async () => {
          const http = partial<Http>({
            getText: () =>
              Promise.reject(
                httpError({
                  request: { context: { urlReplaced: true } },
                  response: { statusCode: 403 },
                }),
              ),
          });

          await downloadHttpProtocol(http, pomUrl);

          expect(logger.logger.debug).toHaveBeenCalledWith(
            { failedUrl: pomUrl, mirror: true },
            'Dependency lookup unauthorized by the urlReplacements mirror',
          );
        });

        it.each`
          status
          ${429}
          ${503}
        `(
          'throws an ExternalHostError and logs the mirror url for a $status of a Maven Central mirror',
          async ({ status }) => {
            vi.spyOn(packageCache, 'getCacheType').mockReturnValue('redis');
            httpMock
              .scope('https://mirror.example.com')
              .get('/maven-public/org/example/foo/1.0.0/foo-1.0.0.pom')
              .reply(status);

            await expect(
              downloadHttpProtocol(new Http('maven'), pomUrl),
            ).rejects.toBeInstanceOf(ExternalHostError);

            expect(logger.logger.debug).toHaveBeenCalledWith(
              {
                failedUrl: mirrorPomUrl,
                mirror: true,
                err: expect.any(HttpError),
              },
              'Temporary error',
            );
          },
        );

        it('logs the mirror url for rate limiting of a Maven Central mirror', async () => {
          vi.spyOn(packageCache, 'getCacheType').mockReturnValue('redis');
          httpMock
            .scope('https://mirror.example.com')
            .get('/maven-public/org/example/foo/1.0.0/foo-1.0.0.pom')
            .reply(429);

          await expect(
            downloadHttpProtocol(new Http('maven'), pomUrl),
          ).rejects.toThrow(ExternalHostError);

          expect(logger.logger.once.warn).toHaveBeenCalledWith(
            { failedUrl: mirrorPomUrl, mirror: true },
            'Maven Central rate limiting detected despite Redis caching.',
          );
        });
      });

      describe('maven-metadata.xml 404 caching', () => {
        const metadataUrl =
          'https://repo.maven.apache.org/maven2/org/example/foo/maven-metadata.xml';

        beforeEach(() => {
          GlobalConfig.set({
            urlReplacements: [
              {
                matchUrlPrefix: 'https://repo.maven.apache.org/maven2/',
                replaceUrlPrefix: 'https://mirror.example.com/maven-public/',
              },
            ],
          });
          vi.spyOn(packageCache, 'get').mockResolvedValue(undefined);
        });

        const mirrorMetadataUrl =
          'https://mirror.example.com/maven-public/org/example/foo/maven-metadata.xml';

        it('caches a 404 of the mirror for 15 minutes under the mirror URL', async () => {
          const setSpy = vi
            .spyOn(packageCache, 'set')
            .mockResolvedValue(undefined);
          httpMock
            .scope('https://mirror.example.com')
            .get('/maven-public/org/example/foo/maven-metadata.xml')
            .reply(404);

          const res = await downloadHttpProtocol(
            new Http('maven'),
            metadataUrl,
          );

          expect(res.unwrap()).toEqual({
            ok: false,
            err: {
              type: 'not-found',
              isMirror: true,
            } satisfies MavenFetchError,
          });
          expect(setSpy).toHaveBeenCalledWith(
            'datasource-maven:metadata-not-found',
            `mirror:${mirrorMetadataUrl}`,
            true,
            15,
          );
        });

        it('caches a 404 of the mirror used directly as registry under the plain URL', async () => {
          const setSpy = vi
            .spyOn(packageCache, 'set')
            .mockResolvedValue(undefined);
          httpMock
            .scope('https://mirror.example.com')
            .get('/maven-public/org/example/foo/maven-metadata.xml')
            .reply(404);

          await downloadHttpProtocol(new Http('maven'), mirrorMetadataUrl);

          expect(setSpy).toHaveBeenCalledWith(
            'datasource-maven:metadata-not-found',
            mirrorMetadataUrl,
            true,
            expect.toBeWithin(720, 840),
          );
        });

        it('reads a cached 404 of the mirror under the mirror URL', async () => {
          const getSpy = vi.spyOn(packageCache, 'get').mockResolvedValue(true);

          const res = await downloadHttpProtocol(
            new Http('maven'),
            metadataUrl,
          );

          expect(res.unwrap()).toEqual({
            ok: false,
            err: { type: 'not-found' } satisfies MavenFetchError,
          });
          expect(getSpy).toHaveBeenCalledExactlyOnceWith(
            'datasource-maven:metadata-not-found',
            `mirror:${mirrorMetadataUrl}`,
          );
        });

        it('reads a cached 404 under the original URL without the rule', async () => {
          GlobalConfig.reset();
          const getSpy = vi.spyOn(packageCache, 'get').mockResolvedValue(true);

          await downloadHttpProtocol(new Http('maven'), metadataUrl);

          expect(getSpy).toHaveBeenCalledExactlyOnceWith(
            'datasource-maven:metadata-not-found',
            metadataUrl,
          );
        });

        it('caches a 404 of the original host for at least 12 hours when the request is not rewritten', async () => {
          const setSpy = vi
            .spyOn(packageCache, 'set')
            .mockResolvedValue(undefined);
          hostRules.add({
            matchHost: 'repo.maven.apache.org',
            token: 'secret',
          });
          httpMock
            .scope('https://repo.maven.apache.org')
            .get('/maven2/org/example/foo/maven-metadata.xml')
            .reply(404);

          const res = await downloadHttpProtocol(
            new Http('maven'),
            metadataUrl,
          );

          expect(res.unwrap()).toEqual({
            ok: false,
            err: { type: 'not-found' } satisfies MavenFetchError,
          });
          expect(setSpy).toHaveBeenCalledWith(
            'datasource-maven:metadata-not-found',
            metadataUrl,
            true,
            expect.toBeWithin(720, 840),
          );
        });

        it('caches a 404 for at least 12 hours for a host type which is never rewritten', async () => {
          const setSpy = vi
            .spyOn(packageCache, 'set')
            .mockResolvedValue(undefined);
          httpMock
            .scope('https://repo.maven.apache.org')
            .get('/maven2/org/example/foo/maven-metadata.xml')
            .reply(404);

          const res = await downloadHttpProtocol(
            new Http('clojure'),
            metadataUrl,
          );

          expect(res.unwrap()).toEqual({
            ok: false,
            err: { type: 'not-found' } satisfies MavenFetchError,
          });
          expect(setSpy).toHaveBeenCalledWith(
            'datasource-maven:metadata-not-found',
            metadataUrl,
            true,
            expect.toBeWithin(720, 840),
          );
        });
      });
    });

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

      it.each([MAVEN_REPO, MAVEN_CENTRAL_MIRROR])(
        'throws ExternalHostError for 429 status with redis cache against Maven Central (%s)',
        async (baseUrl: string) => {
          getCacheTypeSpy.mockReturnValue('redis');
          const http = partial<Http>({
            getText: () =>
              Promise.reject(
                httpError({
                  code: 'ECONNRESET',
                  response: { statusCode: 429 },
                }),
              ),
          });
          await expect(
            downloadHttpProtocol(http, `${MAVEN_REPO}/some/path`),
          ).rejects.toThrow(ExternalHostError);

          expect(logger.logger.once.warn).toHaveBeenCalledWith(
            { failedUrl: `${MAVEN_REPO}/some/path` },
            'Maven Central rate limiting detected despite Redis caching.',
          );
        },
      );

      it('throws ExternalHostError for 429 status without redis cache', async () => {
        getCacheTypeSpy.mockReturnValue('file');
        const http = partial<Http>({
          getText: () =>
            Promise.reject(
              httpError({
                code: 'ECONNRESET',
                response: { statusCode: 429 },
              }),
            ),
        });
        await expect(
          downloadHttpProtocol(http, `${MAVEN_REPO}/some/path`),
        ).rejects.toThrow(ExternalHostError);

        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { failedUrl: `${MAVEN_REPO}/some/path` },
          'Maven Central rate limiting detected. Persistent caching required.',
        );
      });

      it('throws ExternalHostError for non-429 temporary error on maven central', async () => {
        const http = partial<Http>({
          getText: () => Promise.reject(httpError({ code: 'ECONNRESET' })),
        });
        await expect(
          downloadHttpProtocol(http, `${MAVEN_REPO}/some/path`),
        ).rejects.toThrow(ExternalHostError);

        expect(logger.logger.debug).toHaveBeenCalledWith(
          { failedUrl: `${MAVEN_REPO}/some/path`, err: expect.any(HttpError) },
          'Temporary error',
        );
      });

      it('marks the ExternalHostError as failing only the dependency', async () => {
        const http = partial<Http>({
          getText: () => Promise.reject(httpError({ code: 'ECONNRESET' })),
        });

        await expect(
          downloadHttpProtocol(http, `${MAVEN_REPO}/some/path`),
        ).rejects.toMatchObject({ onlyThisDependencyAffected: true });
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
            Promise.reject(httpError({ response: { statusCode: 404 } })),
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
            Promise.reject(httpError({ response: { statusCode: 404 } })),
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

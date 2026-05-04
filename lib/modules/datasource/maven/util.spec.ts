import { vi } from 'vitest';
import { logger, partial } from '~test/util.ts';
import { HOST_DISABLED } from '../../../constants/error-messages.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { Http, HttpError } from '../../../util/http/index.ts';
import { MAVEN_REPO } from './common.ts';
import type { MavenFetchError } from './types.ts';
import {
  downloadArtifactRegistryProtocol,
  downloadHttpContent,
  downloadHttpProtocol,
  downloadMavenXml,
  downloadS3Protocol,
} from './util.ts';

vi.mock('google-auth-library');

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

  describe('downloadArtifactRegistryProtocol', () => {
    const arUrl = new URL(
      'artifactregistry://maven.pkg.dev/some-project/some-repository/org/example/package/1.0.0/package-1.0.0.pom',
    );
    const arApiUrl =
      'https://artifactregistry.googleapis.com/v1/projects/some-project/locations/us/repositories/some-repository/files/org%2Fexample%2Fpackage%2F1.0.0%2Fpackage-1.0.0.pom';

    it('uses RENOVATE_ARTIFACT_REGISTRY_URL env var as base URL for API calls', async () => {
      process.env.RENOVATE_ARTIFACT_REGISTRY_URL =
        'https://custom-artifact-registry.example.com';
      const customApiUrl =
        'https://custom-artifact-registry.example.com/v1/projects/some-project/locations/us/repositories/some-repository/files/org%2Fexample%2Fpackage%2F1.0.0%2Fpackage-1.0.0.pom';

      const getJson = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: { updateTime: '2024-06-01T12:00:00Z' },
        headers: {},
      });

      const http = partial<Http>({
        getText: () =>
          Promise.resolve({
            statusCode: 200,
            body: 'pom content',
            headers: {},
            authorization: false,
          }),
        getJson,
      });

      await downloadArtifactRegistryProtocol(http, arUrl);

      expect(getJson).toHaveBeenCalledWith(
        customApiUrl,
        expect.any(Object),
        expect.any(Object),
      );

      delete process.env.RENOVATE_ARTIFACT_REGISTRY_URL;
    });

    it('enriches result with lastModified from Artifact Registry API', async () => {
      const http = partial<Http>({
        getText: () =>
          Promise.resolve({
            statusCode: 200,
            body: 'pom content',
            headers: {},
            authorization: false,
          }),
        getJson: () =>
          Promise.resolve({
            statusCode: 200,
            body: { updateTime: '2024-06-01T12:00:00Z' } as never,
            headers: {},
          }),
      });

      const res = await downloadArtifactRegistryProtocol(http, arUrl);
      expect(res.unwrap()).toEqual({
        ok: true,
        val: {
          data: 'pom content',
          isCacheable: true,
          lastModified: '2024-06-01T12:00:00.000Z',
        },
      });
    });

    it('does not overwrite lastModified if already set from Last-Modified header', async () => {
      const http = partial<Http>({
        getText: () =>
          Promise.resolve({
            statusCode: 200,
            body: 'pom content',
            headers: { 'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT' },
            authorization: false,
          }),
        getJson: vi.fn(),
      });

      const res = await downloadArtifactRegistryProtocol(http, arUrl);
      const { val } = res.unwrap();
      expect(val?.lastModified).toBe('2024-01-01T00:00:00.000Z');
      expect(http.getJson).not.toHaveBeenCalled();
    });

    it('falls back gracefully when Artifact Registry API call fails', async () => {
      const http = partial<Http>({
        getText: () =>
          Promise.resolve({
            statusCode: 200,
            body: 'pom content',
            headers: {},
            authorization: false,
          }),
        getJson: () => Promise.reject(new Error('API error')),
      });

      const res = await downloadArtifactRegistryProtocol(http, arUrl);
      expect(res.unwrap()).toEqual({
        ok: true,
        val: {
          data: 'pom content',
          isCacheable: true,
        },
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ url: arApiUrl }),
        'Failed to get Artifact Registry file metadata',
      );
    });

    it('returns error when HTTP fetch fails', async () => {
      const http = partial<Http>({
        getText: () => Promise.reject(httpError({ code: 'ENOTFOUND' })),
      });

      const res = await downloadArtifactRegistryProtocol(http, arUrl);
      expect(res.unwrap()).toEqual({
        ok: false,
        err: { type: 'not-found' } satisfies MavenFetchError,
      });
    });

    it('parses location from regional hostname', async () => {
      const regionalUrl = new URL(
        'artifactregistry://europe-maven.pkg.dev/my-project/my-repo/com/example/artifact/1.0/artifact-1.0.pom',
      );
      const expectedApiUrl =
        'https://artifactregistry.googleapis.com/v1/projects/my-project/locations/europe/repositories/my-repo/files/com%2Fexample%2Fartifact%2F1.0%2Fartifact-1.0.pom';

      const getJson = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: { updateTime: '2024-06-01T12:00:00Z' },
        headers: {},
      });

      const http = partial<Http>({
        getText: () =>
          Promise.resolve({
            statusCode: 200,
            body: 'pom content',
            headers: {},
            authorization: false,
          }),
        getJson,
      });

      await downloadArtifactRegistryProtocol(http, regionalUrl);

      expect(getJson).toHaveBeenCalledWith(
        expectedApiUrl,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });
});

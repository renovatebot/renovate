import type { MockInstance } from 'vitest';
import { ZodError, z } from 'zod/v4';
import * as httpMock from '~test/http-mock.ts';
import { logger, partial } from '~test/util.ts';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages.ts';
import { ExternalHostError } from '../../types/errors/external-host-error.ts';
import * as packageCache from '../../util/cache/package/index.ts';
import { HttpError } from '../../util/http/index.ts';
import type { HttpOptions } from '../../util/http/types.ts';
import { Datasource } from './datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from './types.ts';

const exampleUrl = 'https://example.com/';

const ExampleResponse = z.object({ version: z.string() });

class TestDatasource extends Datasource {
  constructor() {
    super('test');
  }

  async getReleases(
    _getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    try {
      await this.http.get(exampleUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }
    return Promise.resolve(null);
  }

  throwError(err: Error): never {
    this.handleGenericErrors(err);
  }
}

class CachedDatasource extends Datasource {
  constructor() {
    super('test');
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached({ key: config.packageName }, () =>
      Promise.resolve<ReleaseResult>({ releases: [{ version: '1.0.0' }] }),
    );
  }

  getConstantValue(): Promise<string> {
    return this.cached(
      { namespace: '_test-namespace', key: 'constant' },
      () => 'value',
    );
  }
}

class JsonDatasource extends Datasource {
  constructor() {
    super('test');
  }

  getReleases(
    _getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return Promise.resolve(null);
  }

  fetch(options?: HttpOptions): Promise<z.infer<typeof ExampleResponse>> {
    return this.fetchJson(exampleUrl, ExampleResponse, options);
  }

  fetchOrNull(
    options?: HttpOptions,
  ): Promise<z.infer<typeof ExampleResponse> | null> {
    return this.fetchJsonOrNull(exampleUrl, ExampleResponse, options);
  }
}

describe('modules/datasource/datasource', () => {
  it('defaults to the first registry strategy', () => {
    expect(new TestDatasource().registryStrategy).toBe('first');
  });

  it('should throw on 429', async () => {
    const testDatasource = new TestDatasource();

    httpMock.scope(exampleUrl).get('/').reply(429);

    await expect(
      testDatasource.getReleases(partial<GetReleasesConfig>()),
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });

  it('rethrows an external host error unchanged', () => {
    const testDatasource = new TestDatasource();
    const err = new ExternalHostError(new Error('original'));

    expect(() => testDatasource.throwError(err)).toThrow(err);
  });

  it('should throw on statusCode >=500 && <600', async () => {
    const testDatasource = new TestDatasource();

    httpMock.scope(exampleUrl).get('/').reply(504);

    await expect(
      testDatasource.getReleases(partial<GetReleasesConfig>()),
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });

  describe('fetchJson', () => {
    it('returns the validated body', async () => {
      const datasource = new JsonDatasource();
      httpMock.scope(exampleUrl).get('/').reply(200, { version: '1.0.0' });

      await expect(datasource.fetch()).resolves.toEqual({ version: '1.0.0' });
    });

    it('passes the options to the http client', async () => {
      const datasource = new JsonDatasource();
      httpMock
        .scope(exampleUrl, { reqheaders: { 'x-some-header': 'some-value' } })
        .get('/')
        .reply(200, { version: '1.0.0' });

      await expect(
        datasource.fetch({ headers: { 'x-some-header': 'some-value' } }),
      ).resolves.toEqual({ version: '1.0.0' });
    });

    it('throws an external host error for a server error', async () => {
      const datasource = new JsonDatasource();
      httpMock.scope(exampleUrl).get('/').reply(500);

      await expect(datasource.fetch()).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('rethrows other http errors', async () => {
      const datasource = new JsonDatasource();
      httpMock.scope(exampleUrl).get('/').reply(404);

      await expect(datasource.fetch()).rejects.toThrow(HttpError);
    });

    it('throws for a response that fails schema validation', async () => {
      const datasource = new JsonDatasource();
      httpMock.scope(exampleUrl).get('/').reply(200, { version: 42 });

      await expect(datasource.fetch()).rejects.toThrow(ZodError);
    });
  });

  describe('fetchJsonOrNull', () => {
    it('returns the validated body', async () => {
      const datasource = new JsonDatasource();
      httpMock.scope(exampleUrl).get('/').reply(200, { version: '1.0.0' });

      await expect(datasource.fetchOrNull()).resolves.toEqual({
        version: '1.0.0',
      });
    });

    it('passes the options to the http client', async () => {
      const datasource = new JsonDatasource();
      httpMock
        .scope(exampleUrl, { reqheaders: { 'x-some-header': 'some-value' } })
        .get('/')
        .reply(200, { version: '1.0.0' });

      await expect(
        datasource.fetchOrNull({ headers: { 'x-some-header': 'some-value' } }),
      ).resolves.toEqual({ version: '1.0.0' });
    });

    it('throws an external host error for a server error', async () => {
      const datasource = new JsonDatasource();
      httpMock.scope(exampleUrl).get('/').reply(500);

      await expect(datasource.fetchOrNull()).rejects.toThrow(
        EXTERNAL_HOST_ERROR,
      );
    });

    it('rethrows other http errors', async () => {
      const datasource = new JsonDatasource();
      httpMock.scope(exampleUrl).get('/').reply(404);

      await expect(datasource.fetchOrNull()).rejects.toThrow(HttpError);
    });

    it('returns null for a response that fails schema validation', async () => {
      const datasource = new JsonDatasource();
      httpMock.scope(exampleUrl).get('/').reply(200, { version: 42 });

      await expect(datasource.fetchOrNull()).resolves.toBeNull();

      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ datasource: 'test', url: exampleUrl }),
        'Ignoring response that failed schema validation',
      );
    });
  });

  describe('cached', () => {
    let setCache: MockInstance<typeof packageCache.setWithRawTtl>;

    beforeEach(() => {
      setCache = vi.spyOn(packageCache, 'setWithRawTtl').mockResolvedValue();
    });

    afterEach(() => {
      setCache.mockRestore();
    });

    it('defaults the namespace to the datasource id', async () => {
      const testDatasource = new CachedDatasource();

      await expect(
        testDatasource.getReleases(
          partial<GetReleasesConfig>({ packageName: 'foo' }),
        ),
      ).resolves.toEqual({ releases: [{ version: '1.0.0' }] });

      expect(setCache).toHaveBeenCalledExactlyOnceWith(
        'datasource-test',
        'cache-decorator:foo',
        {
          cachedAt: expect.any(String),
          value: { releases: [{ version: '1.0.0' }] },
        },
        30,
      );
    });

    it('supports overriding the namespace', async () => {
      const testDatasource = new CachedDatasource();

      await expect(testDatasource.getConstantValue()).resolves.toBe('value');

      expect(setCache).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'cache-decorator:constant',
        { cachedAt: expect.any(String), value: 'value' },
        30,
      );
    });
  });
});

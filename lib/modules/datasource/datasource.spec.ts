import type { MockInstance } from 'vitest';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages.ts';
import * as packageCache from '../../util/cache/package/index.ts';
import { Datasource } from './datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from './types.ts';

const exampleUrl = 'https://example.com/';

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

describe('modules/datasource/datasource', () => {
  it('should throw on 429', async () => {
    const testDatasource = new TestDatasource();

    httpMock.scope(exampleUrl).get('/').reply(429);

    await expect(
      testDatasource.getReleases(partial<GetReleasesConfig>()),
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });

  it('should throw on statusCode >=500 && <600', async () => {
    const testDatasource = new TestDatasource();

    httpMock.scope(exampleUrl).get('/').reply(504);

    await expect(
      testDatasource.getReleases(partial<GetReleasesConfig>()),
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
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

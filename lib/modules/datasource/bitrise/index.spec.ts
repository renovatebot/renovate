import { codeBlock } from 'common-tags';
import { dir as tmpDir } from 'tmp-promise';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { toBase64 } from '../../../util/string.ts';
import { getPkgReleases } from '../index.ts';
import { BitriseDatasource } from './index.ts';

function mockLibrary(apiUrl: string, version: string): void {
  httpMock
    .scope(apiUrl)
    .get('/script')
    .reply(200, [
      { type: 'dir', name: version, path: `steps/script/${version}` },
    ])
    .get(`/script/${version}/step.yml`)
    .reply(200, {
      type: 'file',
      name: 'step.yml',
      path: `steps/script/${version}/step.yml`,
      encoding: 'base64',
      content: toBase64('published_at: 2024-03-19T12:54:48.081Z'),
    });
}

describe('modules/datasource/bitrise/index', () => {
  describe('package cache', () => {
    let cacheDir: Awaited<ReturnType<typeof tmpDir>>;
    const datasource = new BitriseDatasource();
    const result = {
      homepage: 'https://bitrise.io/integrations/steps/script',
      releases: [
        { version: '1.0.0', releaseTimestamp: '2024-03-19T12:54:48.081Z' },
      ],
    };

    beforeEach(async () => {
      GlobalConfig.reset();
      memCache.init();
      cacheDir = await tmpDir({ unsafeCleanup: true });
      await packageCache.init({ cacheDir: cacheDir.path });
    });

    afterEach(async () => {
      await packageCache.cleanup({});
      await cacheDir.cleanup();
      GlobalConfig.reset();
      memCache.init();
    });

    it.each([
      'https://github.com/bitrise-io/bitrise-steplib.git',
      'https://github.com/bitrise-io/bitrise-steplib',
      'HTTPS://GITHUB.COM/BITRISE-IO/BITRISE-STEPLIB',
      'https://github.com:443/bitrise-io/bitrise-steplib.git/',
      'http://github.com:80/bitrise-io/bitrise-steplib/',
      'http://github.com:8080/bitrise-io/bitrise-steplib',
      'ssh://git@github.com/bitrise-io/bitrise-steplib.git',
      'https://github.com/bitrise-io/%62itrise-steplib',
    ])('reuses public releases for %s', async (registryUrl) => {
      // Repository casing survives parsing, while GitHub treats it equivalently.
      const repository = registryUrl.includes('BITRISE-IO')
        ? 'BITRISE-IO/BITRISE-STEPLIB'
        : 'bitrise-io/bitrise-steplib';
      mockLibrary(
        `https://api.github.com/repos/${repository}/contents/steps`,
        '1.0.0',
      );
      const config = { packageName: 'script', registryUrl };
      await expect(datasource.getReleases(config)).resolves.toEqual(result);

      // Clear HTTP memory caching to prove reuse comes from the package cache.
      memCache.init();
      await expect(datasource.getReleases(config)).resolves.toEqual(result);
    });

    it.each([
      [
        'secret://github.com/bitrise-io/bitrise-steplib',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://user:password@github.com/bitrise-io/bitrise-steplib',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://token@github.com/bitrise-io/bitrise-steplib',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'ssh://token@github.com/bitrise-io/bitrise-steplib.git',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'ssh://git:password@github.com/bitrise-io/bitrise-steplib.git',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://github.com/bitrise-io/bitrise-steplib?token=secret',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://github.com/bitrise-io/bitrise-steplib#secret',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://github.com/bitrise-io/bitrise-steplib/tree/secret',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://github.com/bitrise-io/secret/../bitrise-steplib',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://github.com/custom/private-library',
        'https://api.github.com/repos/custom/private-library',
      ],
      [
        'https://github.mycompany.com/bitrise-io/bitrise-steplib',
        'https://github.mycompany.com/api/v3/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://www.github.com/bitrise-io/bitrise-steplib',
        'https://www.github.com/api/v3/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://github.com.evil.test/bitrise-io/bitrise-steplib',
        'https://github.com.evil.test/api/v3/repos/bitrise-io/bitrise-steplib',
      ],
      [
        'https://github.com/bitrise-io/bitrise-steplib-other',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib-other',
      ],
      [
        'https://github.com/bitrise-io/bitrise-steplib/extra',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib/extra',
      ],
      [
        'https://github.com/bitrise-io/bitrise-steplib%2Fextra',
        'https://api.github.com/repos/bitrise-io/bitrise-steplib/extra',
      ],
    ])(
      'bypasses existing entries and does not cache %s',
      async (registryUrl, repositoryUrl) => {
        const config = { packageName: 'script', registryUrl };
        const cachedRecord = {
          cachedAt: new Date().toISOString(),
          value: { releases: [{ version: '9.0.0' }] },
        };
        await packageCache.set(
          'datasource-bitrise',
          `cache-decorator:${registryUrl}/script`,
          cachedRecord,
          60,
        );
        mockLibrary(`${repositoryUrl}/contents/steps`, '1.0.0');
        await expect(datasource.getReleases(config)).resolves.toEqual(result);

        memCache.init();
        mockLibrary(`${repositoryUrl}/contents/steps`, '2.0.0');
        await expect(datasource.getReleases(config)).resolves.toEqual({
          ...result,
          releases: [
            { version: '2.0.0', releaseTimestamp: '2024-03-19T12:54:48.081Z' },
          ],
        });
        await expect(
          packageCache.get(
            'datasource-bitrise',
            `cache-decorator:${registryUrl}/script`,
          ),
        ).resolves.toEqual(cachedRecord);
      },
    );

    it('preserves asynchronous lookup errors for malformed percent encoding', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'script',
          registryUrl: 'https://github.com/bitrise-io/bitrise-steplib%FF',
        }),
      ).rejects.toThrow(URIError);
    });

    it('does not fall back to private releases when lookup fails', async () => {
      const registryUrl = 'https://github.com/custom/private-library';
      await packageCache.set(
        'datasource-bitrise',
        `cache-decorator:${registryUrl}/script`,
        {
          cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          value: result,
        },
        120,
      );
      httpMock
        .scope(
          'https://api.github.com/repos/custom/private-library/contents/steps',
        )
        .get('/script')
        .reply(404);
      await expect(
        datasource.getReleases({ packageName: 'script', registryUrl }),
      ).rejects.toThrow('Request failed with status code 404 (Not Found)');
    });

    it('honors the cachePrivatePackages override for custom libraries', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });
      const registryUrl = 'https://github.com/custom/private-library';
      const config = { packageName: 'script', registryUrl };
      mockLibrary(
        'https://api.github.com/repos/custom/private-library/contents/steps',
        '1.0.0',
      );
      await expect(datasource.getReleases(config)).resolves.toEqual(result);

      memCache.init();
      await expect(datasource.getReleases(config)).resolves.toEqual(result);
    });

    it.each([
      undefined,
      'git@github.com:bitrise-io/bitrise-steplib.git',
      'https://gitlab.com/bitrise-io/bitrise-steplib',
    ])(
      'does not reuse entries for unsupported registry %s',
      async (registryUrl) => {
        await packageCache.set(
          'datasource-bitrise',
          `cache-decorator:${registryUrl}/script`,
          { cachedAt: new Date().toISOString(), value: result },
          60,
        );
        await expect(
          datasource.getReleases({ packageName: 'script', registryUrl }),
        ).resolves.toBeNull();
      },
    );
  });

  describe('getReleases()', () => {
    beforeEach(() => {
      memCache.init();
    });

    it('returns null for unsupported registryUrl', async () => {
      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'script',
          registryUrls: ['https://gitlab.com/bitrise-io/bitrise-steplib'],
        }),
      ).resolves.toBeNull();
    });

    it('support GitHub Enterprise API URL', async () => {
      httpMock
        .scope(
          'https://github.mycompany.com/api/v3/repos/foo/bar/contents/steps',
        )
        .get('/script')
        .reply(200, [
          {
            type: 'dir',
            name: '1.0.0',
            path: 'steps/script/1.0.0',
          },
        ])
        .get('/script/1.0.0/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/script/1.0.0/step.yml',
          encoding: 'base64',
          content: toBase64(codeBlock`
          published_at: 2024-03-19T13:54:48.081077+01:00
          source_code_url: https://github.com/bitrise-steplib/bitrise-step-script
          website: https://github.com/bitrise-steplib/bitrise-step-script
        `),
        });
      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'script',
          registryUrls: ['https://github.mycompany.com/foo/bar'],
        }),
      ).resolves.toEqual({
        homepage: 'https://bitrise.io/integrations/steps/script',
        registryUrl: 'https://github.mycompany.com/foo/bar',
        releases: [
          {
            releaseTimestamp: '2024-03-19T12:54:48.081Z',
            sourceUrl: 'https://github.com/bitrise-steplib/bitrise-step-script',
            version: '1.0.0',
          },
        ],
      });
    });

    it('returns version and filters out the asset folder', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/activate-build-cache-for-bazel')
        .reply(200, [
          {
            type: 'dir',
            name: '1.0.0',
            path: 'steps/activate-build-cache-for-bazel/1.0.0',
          },
          {
            type: 'dir',
            name: '1.0.1',
            path: 'steps/activate-build-cache-for-bazel/1.0.1',
          },
          {
            type: 'dir',
            name: 'assets',
            path: 'steps/activate-build-cache-for-bazel/assets',
          },
        ])
        .get('/activate-build-cache-for-bazel/1.0.0/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/activate-build-cache-for-bazel/1.0.0/step.yml',
          encoding: 'base64',
          content: toBase64(codeBlock`
          published_at: 2024-03-19T13:54:48.081077+01:00
          source_code_url: https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel
          website: https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel
        `),
        })
        .get('/activate-build-cache-for-bazel/1.0.1/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/activate-build-cache-for-bazel/1.0.1/step.yml',
          encoding: 'base64',
          content: toBase64(codeBlock`
          published_at: "2024-07-03T08:53:25.668504731Z"
          source_code_url: https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel
          website: https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel
        `),
        });

      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'activate-build-cache-for-bazel',
        }),
      ).resolves.toEqual({
        homepage:
          'https://bitrise.io/integrations/steps/activate-build-cache-for-bazel',
        registryUrl: 'https://github.com/bitrise-io/bitrise-steplib.git',
        releases: [
          {
            releaseTimestamp: '2024-03-19T12:54:48.081Z',
            sourceUrl:
              'https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel',
            version: '1.0.0',
          },
          {
            releaseTimestamp: '2024-07-03T08:53:25.668Z',
            sourceUrl:
              'https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel',
            version: '1.0.1',
          },
        ],
      });
    });

    it('returns null if there are no releases', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/activate-build-cache-for-bazel')
        .reply(200, [
          {
            type: 'dir',
            name: 'assets',
            path: 'steps/activate-build-cache-for-bazel/assets',
          },
        ]);

      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'activate-build-cache-for-bazel',
        }),
      ).resolves.toBeNull();
    });

    it('returns null if the package has an unexpected format', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/activate-build-cache-for-bazel')
        .reply(200, {
          type: 'file',
          name: 'assets',
          path: 'steps/activate-build-cache-for-bazel/assets',
        });

      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'activate-build-cache-for-bazel',
        }),
      ).resolves.toBeNull();
    });

    it('returns null if the file object has no content', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/script')
        .reply(200, [
          {
            type: 'dir',
            name: '1.0.0',
            path: 'steps/script/1.0.0',
          },
        ])
        .get('/script/1.0.0/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/script/1.0.0/step.yml',
        });
      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'script',
        }),
      ).resolves.toBeNull();
    });

    it('returns null if the file object has an unexpected encoding', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/script')
        .reply(200, [
          {
            type: 'dir',
            name: '1.0.0',
            path: 'steps/script/1.0.0',
          },
        ])
        .get('/script/1.0.0/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/script/1.0.0/step.yml',
          encoding: 'none',
          content: '',
        });
      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'script',
        }),
      ).resolves.toBeNull();
    });
  });
});

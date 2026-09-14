import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { parseUrl } from '../../../util/url.ts';
import { getPkgReleases } from '../index.ts';
import { Unity3dDatasource } from './index.ts';
import { UnityReleasesJSON } from './schema.ts';

describe('modules/datasource/unity3d/index', () => {
  const fixtures = Object.fromEntries(
    Object.keys(Unity3dDatasource.streams).map((fixture) => [
      fixture,
      Fixtures.get(`${fixture}.json`),
    ]),
  );

  function mockUnityReleasesApi(streams: Record<string, string>) {
    for (const stream in streams) {
      const content = fixtures[stream];

      const uri = parseUrl(streams[stream])!;
      httpMock
        .scope(uri.origin)
        .get(`${uri.pathname}${uri.search}`)
        .reply(200, content);
    }
  }

  function createUnityReleases(
    total: number,
    offset: number,
    resultCount: number,
  ): UnityReleasesJSON {
    const results = [];

    for (let i = 1; i <= resultCount; i++) {
      results.push({
        version: `6000.0.${offset + i}f1`,
        releaseDate: '2024-12-18T08:40:10.134Z',
        releaseNotes: {
          url: 'testUrl',
        },
        shortRevision: '0115cb901a32',
      });
    }

    return UnityReleasesJSON.parse({
      total,
      results,
    });
  }

  it.each([
    Unity3dDatasource.streams.lts,
    Unity3dDatasource.legacyStreams.lts,
    Unity3dDatasource.legacyStreams.stable,
  ])('returns lts if requested %s', async (registryUrl) => {
    mockUnityReleasesApi({
      lts: `${Unity3dDatasource.streams.lts}&limit=25&offset=0`,
    });
    const responses = (await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [registryUrl],
    }))!;

    expect(responses).toEqual({
      releases: [
        {
          changelogUrl:
            'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/2022_3_55f1_e905b1c414/2022_3_55f1_e905b1c414.md',
          isStable: true,
          releaseTimestamp: '2024-12-17T16:21:09.410Z',
          version: '2022.3.55f1',
        },
        {
          changelogUrl:
            'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_0_32f1_a564232097/6000_0_32f1_a564232097.md',
          isStable: true,
          releaseTimestamp: '2024-12-19T15:34:00.072Z',
          version: '6000.0.32f1',
        },
      ],
      homepage: 'https://unity.com/',
      registryUrl: Unity3dDatasource.streams.lts,
    });
  });

  it('returns tech if requested', async () => {
    mockUnityReleasesApi({
      tech: `${Unity3dDatasource.streams.tech}&limit=25&offset=0`,
    });
    const responses = (await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.tech],
    }))!;

    expect(responses).toEqual({
      releases: [
        {
          changelogUrl:
            'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_0_21f1_2b136c8c81/6000_0_21f1_2b136c8c81.md',
          isStable: false,
          releaseTimestamp: '2024-09-24T16:11:20.586Z',
          version: '6000.0.21f1',
        },
        {
          changelogUrl:
            'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_0_22f1_bde815b68f/6000_0_22f1_bde815b68f.md',
          isStable: false,
          releaseTimestamp: '2024-10-02T19:04:27.205Z',
          version: '6000.0.22f1',
        },
      ],
      homepage: 'https://unity.com/',
      registryUrl: Unity3dDatasource.streams.tech,
    });
  });

  it('returns alpha if requested', async () => {
    mockUnityReleasesApi({
      alpha: `${Unity3dDatasource.streams.alpha}&limit=25&offset=0`,
    });
    const responses = (await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.alpha],
    }))!;

    expect(responses).toEqual({
      releases: [
        {
          changelogUrl:
            'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_1_0a8_2d1304db16/6000_1_0a8_2d1304db16.md',
          isStable: false,
          releaseTimestamp: '2024-12-10T20:17:32.592Z',
          version: '6000.1.0a8',
        },
        {
          changelogUrl:
            'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_1_0a9_a19280e20b/6000_1_0a9_a19280e20b.md',
          isStable: false,
          releaseTimestamp: '2024-12-18T08:40:10.134Z',
          version: '6000.1.0a9',
        },
      ],
      homepage: 'https://unity.com/',
      registryUrl: Unity3dDatasource.streams.alpha,
    });
  });

  it.each([
    Unity3dDatasource.streams.beta,
    Unity3dDatasource.legacyStreams.beta,
  ])('returns beta if requested %s', async (registryUrl) => {
    mockUnityReleasesApi({
      beta: `${Unity3dDatasource.streams.beta}&limit=25&offset=0`,
    });
    const responses = (await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [registryUrl],
    }))!;

    expect(responses).toEqual({
      releases: [
        {
          changelogUrl:
            'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_0_0b15_d7e1e209b0/6000_0_0b15_d7e1e209b0.md',
          isStable: false,
          releaseTimestamp: '2024-04-13T00:46:31.309Z',
          version: '6000.0.0b15',
        },
        {
          changelogUrl:
            'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_0_0b16_c8ac27cff6/6000_0_0b16_c8ac27cff6.md',
          isStable: false,
          releaseTimestamp: '2024-04-19T15:47:47.012Z',
          version: '6000.0.0b16',
        },
      ],
      homepage: 'https://unity.com/',
      registryUrl: Unity3dDatasource.streams.beta,
    });
  });

  it('returns lts releases by default', async () => {
    mockUnityReleasesApi({
      lts: `${Unity3dDatasource.streams.lts}&limit=25&offset=0`,
    });
    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
    });

    expect(responses).toEqual(
      expect.objectContaining({
        releases: [
          {
            changelogUrl:
              'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/2022_3_55f1_e905b1c414/2022_3_55f1_e905b1c414.md',
            isStable: true,
            releaseTimestamp: '2024-12-17T16:21:09.410Z',
            version: '2022.3.55f1',
          },
          {
            changelogUrl:
              'https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_0_32f1_a564232097/6000_0_32f1_a564232097.md',
            isStable: true,
            releaseTimestamp: '2024-12-19T15:34:00.072Z',
            version: '6000.0.32f1',
          },
        ],
        homepage: 'https://unity.com/',
        registryUrl: Unity3dDatasource.streams.lts,
      }),
    );

    expect(responses).toEqual(
      expect.objectContaining({
        releases: expect.not.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/\(b\)/),
          }),
          expect.objectContaining({
            version: expect.stringMatching(/\(b\)/),
          }),
        ]),
        homepage: 'https://unity.com/',
        registryUrl: Unity3dDatasource.streams.lts,
      }),
    );
  });

  it('returns hash if requested', async () => {
    mockUnityReleasesApi({
      lts: `${Unity3dDatasource.streams.lts}&limit=25&offset=0`,
    });
    const responsesWithHash = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersionWithRevision',
      registryUrls: [Unity3dDatasource.streams.lts],
    });

    expect(responsesWithHash).toEqual(
      expect.objectContaining({
        releases: expect.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/\(.*\)/),
          }),
        ]),
        homepage: 'https://unity.com/',
        registryUrl: Unity3dDatasource.streams.lts,
      }),
    );
  });

  it('returns no hash if not requested', async () => {
    mockUnityReleasesApi({
      lts: `${Unity3dDatasource.streams.lts}&limit=25&offset=0`,
    });
    const responsesWithoutHash = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.lts],
    });

    expect(responsesWithoutHash).toEqual(
      expect.objectContaining({
        releases: expect.not.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/\(.*\)/),
          }),
        ]),
        homepage: 'https://unity.com/',
        registryUrl: Unity3dDatasource.streams.lts,
      }),
    );
  });

  it('returns only lts by default', async () => {
    mockUnityReleasesApi({
      lts: `${Unity3dDatasource.streams.lts}&limit=25&offset=0`,
    });
    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersionWithRevision',
    });

    expect(responses).toEqual(
      expect.objectContaining({
        releases: expect.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/[fp]/),
          }),
          expect.objectContaining({
            version: expect.stringMatching(/[fp]/),
          }),
        ]),
        homepage: 'https://unity.com/',
        registryUrl: expect.stringMatching(/(?:releases|lts)/),
      }),
    );
  });

  it('uses pagination', async () => {
    const uriPageOne = parseUrl(
      `${Unity3dDatasource.streams.lts}&limit=25&offset=0`,
    )!;
    const uriPageTwo = parseUrl(
      `${Unity3dDatasource.streams.lts}&limit=25&offset=25`,
    )!;

    const total = 30;

    httpMock
      .scope(uriPageOne.origin)
      .get(`${uriPageOne.pathname}${uriPageOne.search}`)
      .reply(200, createUnityReleases(total, 0, 25));
    httpMock
      .scope(uriPageTwo.origin)
      .get(`${uriPageTwo.pathname}${uriPageTwo.search}`)
      .reply(200, createUnityReleases(total, 25, 5));

    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
    });

    expect(responses?.releases).toBeArrayOfSize(total);
  });

  describe('package cache', () => {
    let cacheDir: string;
    const datasource = new Unity3dDatasource();
    const packageName = 'm_EditorVersion';
    const namespace = 'datasource-unity3d';

    beforeEach(async () => {
      GlobalConfig.set({ cachePrivatePackages: false });
      memCache.init();
      cacheDir = await mkdtemp(join(tmpdir(), 'unity3d-cache-'));
      await packageCache.init({ cacheDir });
    });

    afterEach(async () => {
      await packageCache.cleanup({});
      await rm(cacheDir, { recursive: true, force: true });
      memCache.init();
    });

    function mockRequest(registryUrl: string, offset: number) {
      const url = parseUrl(
        `${datasource.translateStream(registryUrl)}&limit=25&offset=0`,
      )!;
      httpMock
        .scope(url.origin)
        .get(`${url.pathname}${url.search}`)
        .reply(200, createUnityReleases(1, offset, 1));
    }

    it.each`
      registryUrl                                                                              | isStable
      ${Unity3dDatasource.streams.lts}                                                         | ${true}
      ${Unity3dDatasource.streams.tech}                                                        | ${false}
      ${Unity3dDatasource.streams.alpha}                                                       | ${false}
      ${Unity3dDatasource.streams.beta}                                                        | ${false}
      ${Unity3dDatasource.legacyStreams.lts}                                                   | ${true}
      ${Unity3dDatasource.legacyStreams.stable}                                                | ${true}
      ${Unity3dDatasource.legacyStreams.beta}                                                  | ${false}
      ${'HTTPS://SERVICES.API.UNITY.COM:443/unity/editor/release/v1/releases?stream=LTS'}      | ${false}
      ${`${Unity3dDatasource.baseUrl}?platform=WINDOWS&architecture=X86_64&stream=LTS`}        | ${false}
      ${`${Unity3dDatasource.baseUrl}?version=6000.0.1f1&order=RELEASE_DATE_ASC`}              | ${false}
      ${`${Unity3dDatasource.baseUrl}?limit=1&offset=0&stream=LTS`}                            | ${false}
      ${`${Unity3dDatasource.baseUrl}?%73tream=LTS&stream=BETA`}                               | ${false}
      ${'https://services.api.unity.com/unity/editor/release/v1/other/../releases?stream=LTS'} | ${false}
      ${'https://services.api.unity.com/unity/editor/release/v1/%2e/releases?stream=LTS'}      | ${false}
    `(
      'reuses public releases for $registryUrl',
      async ({ registryUrl, isStable }) => {
        mockRequest(registryUrl, 0);

        const first = await datasource.getReleases({
          packageName,
          registryUrl,
        });
        memCache.init();
        const second = await datasource.getReleases({
          packageName,
          registryUrl,
        });

        expect(first?.releases).toEqual([
          {
            version: '6000.0.1f1',
            releaseTimestamp: '2024-12-18T08:40:10.134Z',
            changelogUrl: 'testUrl',
            isStable,
          },
        ]);
        expect(second).toEqual(first);
      },
    );

    it.each([
      'https://private.example/releases?stream=LTS',
      `${Unity3dDatasource.baseUrl}?stream=LTS#private-token`,
      'http://services.api.unity.com/unity/editor/release/v1/releases?stream=LTS',
      'https://services.api.unity.com:444/unity/editor/release/v1/releases?stream=LTS',
      'https://services.api.unity.com.evil.example/unity/editor/release/v1/releases?stream=LTS',
      'https://services.api.unity.com./unity/editor/release/v1/releases?stream=LTS',
      `${Unity3dDatasource.baseUrl}/?stream=LTS`,
      `${Unity3dDatasource.baseUrl}.git?stream=LTS`,
      `${Unity3dDatasource.baseUrl}/private?stream=LTS`,
      'https://services.api.unity.com/unity/editor/release/v1/%72eleases?stream=LTS',
      'https://services.api.unity.com/unity/editor/release/v1/releases%2fprivate?stream=LTS',
      `${Unity3dDatasource.baseUrl}?project=private`,
      `${Unity3dDatasource.baseUrl}?Stream=LTS`,
      Unity3dDatasource.baseUrl,
      `${Unity3dDatasource.legacyStreams.lts}?stream=LTS`,
      'https://user:password@services.api.unity.com/unity/editor/release/v1/releases?stream=LTS',
    ])('bypasses existing entries and writes for %s', async (registryUrl) => {
      const key = `cache-decorator:${registryUrl}:${packageName}`;
      const cached = {
        cachedAt: new Date().toISOString(),
        value: { releases: [{ version: 'private' }] },
      };
      await packageCache.set(namespace, key, cached, 60);
      mockRequest(registryUrl, 0);

      const first = await datasource.getReleases({ packageName, registryUrl });
      memCache.init();
      mockRequest(registryUrl, 1);
      const second = await datasource.getReleases({ packageName, registryUrl });

      expect(first?.releases.map(({ version }) => version)).toEqual([
        '6000.0.1f1',
      ]);
      expect(second?.releases.map(({ version }) => version)).toEqual([
        '6000.0.2f1',
      ]);
      memCache.init();
      await expect(packageCache.get(namespace, key)).resolves.toEqual(cached);
    });

    it('does not fall back to stale custom-feed releases on failure', async () => {
      const registryUrl = 'https://private.example/releases?stream=LTS';
      const key = `cache-decorator:${registryUrl}:${packageName}`;
      const cached = {
        cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        value: { releases: [{ version: 'private' }] },
      };
      await packageCache.set(namespace, key, cached, 60);
      httpMock
        .scope('https://private.example')
        .get('/releases?stream=LTS&limit=25&offset=0')
        .reply(404);

      await expect(
        datasource.getReleases({ packageName, registryUrl }),
      ).rejects.toThrow('Request failed with status code 404 (Not Found)');

      await expect(packageCache.get(namespace, key)).resolves.toEqual(cached);
    });

    it('does not return cached releases for an invalid URL', async () => {
      const registryUrl = 'not-a-url';
      const key = `cache-decorator:${registryUrl}:${packageName}`;
      const cached = {
        cachedAt: new Date().toISOString(),
        value: { releases: [{ version: 'private' }] },
      };
      await packageCache.set(namespace, key, cached, 60);

      await expect(
        datasource.getReleases({ packageName, registryUrl }),
      ).rejects.toThrow('Invalid URL');

      await expect(packageCache.get(namespace, key)).resolves.toEqual(cached);
    });

    it('honors the explicit private-package cache override', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });
      const registryUrl = 'https://private.example/releases?stream=LTS';
      mockRequest(registryUrl, 0);

      const first = await datasource.getReleases({ packageName, registryUrl });
      memCache.init();
      const second = await datasource.getReleases({ packageName, registryUrl });

      expect(first?.releases.map(({ version }) => version)).toEqual([
        '6000.0.1f1',
      ]);
      expect(second).toEqual(first);
    });
  });
});

import { getPkgReleases } from '..';
import { Unity3dDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/unity3d/index', () => {
  const fixtures = Object.fromEntries(
    [...Object.keys(Unity3dDatasource.streams)].map((fixture) => [
      fixture,
      Fixtures.get(`${fixture}.json`),
    ]),
  );

  const mockUnityReleasesApi = (streams: Record<string, string>) => {
    for (const stream in streams) {
      const content = fixtures[stream];

      const uri = new URL(streams[stream]);
      httpMock
        .scope(uri.origin)
        .get(`${uri.pathname}${uri.search}`)
        .reply(200, content);
    }
  };

  it.each([
    Unity3dDatasource.streams.lts,
    Unity3dDatasource.legacyStreams.lts,
    Unity3dDatasource.legacyStreams.stable,
  ])('returns lts if requested %s', async (registryUrl) => {
    mockUnityReleasesApi({ lts: Unity3dDatasource.streams.lts });
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
    mockUnityReleasesApi({ tech: Unity3dDatasource.streams.tech });
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
    mockUnityReleasesApi({ alpha: Unity3dDatasource.streams.alpha });
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
    mockUnityReleasesApi({ beta: Unity3dDatasource.streams.beta });
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
    mockUnityReleasesApi({ lts: Unity3dDatasource.streams.lts });
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
    mockUnityReleasesApi({ lts: Unity3dDatasource.streams.lts });
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
    mockUnityReleasesApi({ lts: Unity3dDatasource.streams.lts });
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
    mockUnityReleasesApi({ lts: Unity3dDatasource.streams.lts });
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
        registryUrl: expect.stringMatching(/(releases|lts)/),
      }),
    );
  });
});

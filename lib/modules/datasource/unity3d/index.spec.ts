import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { Unity3dDatasource } from '.';

describe('modules/datasource/unity3d/index', () => {
  const fixtures = Object.fromEntries(
    [
      ...Object.keys(Unity3dDatasource.streams),
      'no_title',
      'no_channel',
      'no_item',
    ].map((fixture) => [fixture, Fixtures.get(fixture + '.xml')]),
  );

  const mockRSSFeeds = (streams: { [keys: string]: string }) => {
    Object.entries(streams).map(([stream, url]) => {
      const content = fixtures[stream];

      const uri = new URL(url);

      httpMock.scope(uri.origin).get(uri.pathname).reply(200, content);
    });
  };

  const stableStreamUrl = new URL(Unity3dDatasource.streams.stable);

  it('handle 500 response', async () => {
    httpMock
      .scope(stableStreamUrl.origin)
      .get(stableStreamUrl.pathname)
      .reply(500, '500');

    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    const response = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.stable],
    });

    expect(response).toBeNull();
  });

  it('handle 200 with no XML', async () => {
    httpMock
      .scope(stableStreamUrl.origin)
      .get(stableStreamUrl.pathname)
      .reply(200, 'not xml');

    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    const response = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.stable],
    });

    expect(response).toBeNull();
  });

  it('handles missing title element', async () => {
    const content = fixtures.no_title;
    httpMock
      .scope(stableStreamUrl.origin)
      .get(stableStreamUrl.pathname)
      .reply(200, content);

    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.stable],
    });

    expect(responses).toEqual({
      releases: [],
      homepage: 'https://unity.com/',
      registryUrl: Unity3dDatasource.streams.stable,
    });
  });

  it('handles missing channel element', async () => {
    const content = fixtures.no_channel;
    httpMock
      .scope(stableStreamUrl.origin)
      .get(stableStreamUrl.pathname)
      .reply(200, content);

    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.stable],
    });

    expect(responses).toEqual({
      releases: [],
      homepage: 'https://unity.com/',
      registryUrl: Unity3dDatasource.streams.stable,
    });
  });

  it('handles missing item element', async () => {
    const content = fixtures.no_item;
    httpMock
      .scope(stableStreamUrl.origin)
      .get(stableStreamUrl.pathname)
      .reply(200, content);

    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.stable],
    });

    expect(responses).toEqual({
      releases: [],
      homepage: 'https://unity.com/',
      registryUrl: Unity3dDatasource.streams.stable,
    });
  });

  it('returns beta if requested', async () => {
    mockRSSFeeds({ beta: Unity3dDatasource.streams.beta });
    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.beta],
    });

    expect(responses).toEqual({
      registryUrl: Unity3dDatasource.streams.beta,
      releases: [
        {
          changelogUrl: 'https://unity.com/releases/editor/beta/2023.3.0b6',
          isStable: false,
          registryUrl: Unity3dDatasource.streams.beta,
          releaseTimestamp: '2024-02-07T07:24:40.000Z',
          version: '2023.3.0b6',
        },
      ],
      homepage: 'https://unity.com/',
    });
  });

  it('returns stable and lts releases by default', async () => {
    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    mockRSSFeeds(qualifyingStreams);
    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
    });

    expect(responses).toEqual(
      expect.objectContaining({
        releases: [
          {
            changelogUrl:
              'https://unity.com/releases/editor/whats-new/2021.3.35',
            isStable: true,
            registryUrl: Unity3dDatasource.streams.stable,
            releaseTimestamp: '2024-02-06T15:40:15.000Z',
            version: '2021.3.35f1',
          },
          {
            changelogUrl:
              'https://unity.com/releases/editor/whats-new/2023.2.9',
            isStable: true,
            registryUrl: Unity3dDatasource.streams.stable,
            releaseTimestamp: '2024-02-07T06:56:57.000Z',
            version: '2023.2.9f1',
          },
        ],
        homepage: 'https://unity.com/',
      }),
    );

    expect(responses).toEqual(
      expect.objectContaining({
        releases: expect.not.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/\(b\)/),
            registryUrl: Unity3dDatasource.streams.beta,
          }),
          expect.objectContaining({
            version: expect.stringMatching(/\(b\)/),
            registryUrl: Unity3dDatasource.streams.beta,
          }),
        ]),
        homepage: 'https://unity.com/',
      }),
    );
  });

  it('returns hash if requested', async () => {
    mockRSSFeeds({ stable: Unity3dDatasource.streams.stable });
    const responsesWithHash = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersionWithRevision',
      registryUrls: [Unity3dDatasource.streams.stable],
    });

    expect(responsesWithHash).toEqual(
      expect.objectContaining({
        releases: expect.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/\(.*\)/),
          }),
        ]),
        homepage: 'https://unity.com/',
        registryUrl: Unity3dDatasource.streams.stable,
      }),
    );
  });

  it('returns no hash if not requested', async () => {
    mockRSSFeeds({ stable: Unity3dDatasource.streams.stable });
    const responsesWithoutHash = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersion',
      registryUrls: [Unity3dDatasource.streams.stable],
    });

    expect(responsesWithoutHash).toEqual(
      expect.objectContaining({
        releases: expect.not.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/\(.*\)/),
          }),
        ]),
        homepage: 'https://unity.com/',
        registryUrl: Unity3dDatasource.streams.stable,
      }),
    );
  });

  it('returns different versions for each stream', async () => {
    mockRSSFeeds(Unity3dDatasource.streams);
    const responses: { [keys: string]: string[] } = Object.fromEntries(
      await Promise.all(
        Object.keys(Unity3dDatasource.streams).map(async (stream) => [
          stream,
          (
            await getPkgReleases({
              datasource: Unity3dDatasource.id,
              packageName: 'm_EditorVersion',
              registryUrls: [Unity3dDatasource.streams[stream]],
            })
          )?.releases.map((release) => release.version),
        ]),
      ),
    );

    // none of the items in responses.beta are in responses.stable or responses.lts
    expect(
      responses.beta.every(
        (betaVersion) =>
          !responses.stable.includes(betaVersion) &&
          !responses.lts.includes(betaVersion),
      ),
    ).toBe(true);
    // some items in responses.stable are in responses.lts
    expect(
      responses.stable.some((stableVersion) =>
        responses.lts.includes(stableVersion),
      ),
    ).toBe(true);
    // not all items in responses.stable are in responses.lts
    expect(
      responses.stable.every((stableVersion) =>
        responses.lts.includes(stableVersion),
      ),
    ).toBe(false);
  });

  it('returns only lts and stable by default', async () => {
    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    mockRSSFeeds(qualifyingStreams);
    const responses = await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersionWithRevision',
    });

    expect(responses).toEqual(
      expect.objectContaining({
        releases: expect.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/[fp]/),
            registryUrl: expect.stringMatching(/(releases|lts)/),
          }),
          expect.objectContaining({
            version: expect.stringMatching(/[fp]/),
            registryUrl: expect.stringMatching(/(releases|lts)/),
          }),
        ]),
        homepage: 'https://unity.com/',
      }),
    );
  });
});

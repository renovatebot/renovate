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

    expect(responses).toEqual(
      expect.objectContaining({
        releases: expect.arrayContaining([]),
      }),
    );
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

    expect(responses).toEqual(
      expect.objectContaining({
        releases: expect.arrayContaining([]),
      }),
    );
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

    expect(responses).toEqual(
      expect.objectContaining({
        releases: expect.arrayContaining([]),
      }),
    );
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
        releases: expect.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/f/),
          }),
        ]),
      }),
    );

    expect(responses).toEqual(
      expect.objectContaining({
        releases: expect.not.arrayContaining([
          expect.objectContaining({
            version: expect.stringMatching(/\(b\)/),
          }),
        ]),
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
          }),
        ]),
      }),
    );
  });
});

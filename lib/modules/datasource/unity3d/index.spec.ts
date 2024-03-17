import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { Unity3dDatasource } from '.';

const mockRSSFeeds = (streams: { [keys: string]: string }) => {
  Object.entries(streams).map(([stream, url]) => {
    const content = Fixtures.get(stream + '.xml');

    const uri = new URL(url);

    httpMock.scope(uri.origin).get(uri.pathname).reply(200, content);
  });
};

describe('modules/datasource/unity3d/index', () => {
  it('handles missing channel element', async () => {
    const content = Fixtures.get('no_channel.xml');
    const uri = new URL(Unity3dDatasource.streams.stable);
    httpMock.scope(uri.origin).get(uri.pathname).reply(200, content);

    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    const responses = (
      await getPkgReleases({
        datasource: Unity3dDatasource.id,
        packageName: 'm_EditorVersion',
        registryUrls: [Unity3dDatasource.streams.stable],
      })
    )?.releases.map((release) => release.version);

    expect(responses!).toHaveLength(0);
  });

  it('handles missing item element', async () => {
    const content = Fixtures.get('no_item.xml');
    const uri = new URL(Unity3dDatasource.streams.stable);
    httpMock.scope(uri.origin).get(uri.pathname).reply(200, content);

    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    const responses = (
      await getPkgReleases({
        datasource: Unity3dDatasource.id,
        packageName: 'm_EditorVersion',
        registryUrls: [Unity3dDatasource.streams.stable],
      })
    )?.releases.map((release) => release.version);

    expect(responses!).toHaveLength(0);
  });

  it('returns stable and lts releases by default', async () => {
    const qualifyingStreams = { ...Unity3dDatasource.streams };
    delete qualifyingStreams.beta;
    mockRSSFeeds(qualifyingStreams);
    const responses = (
      await getPkgReleases({
        datasource: Unity3dDatasource.id,
        packageName: 'm_EditorVersion',
      })
    )?.releases.map((release) => release.version);

    // check that only letter f is present (final releases)
    expect(responses!.every((version) => /[fp]/.test(version))).toBe(true);
    // check that no version contains the letter b (beta release)
    expect(responses!.every((version) => !/b/.test(version))).toBe(true);
  });

  it('returns hash if requested', async () => {
    mockRSSFeeds({ stable: Unity3dDatasource.streams.stable });
    const responsesWithoutHash = (await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersionWithRevision',
      registryUrls: [Unity3dDatasource.streams.stable],
    }))!.releases.map((release) => release.version);

    expect(responsesWithoutHash.length).toBeGreaterThan(0);
    expect(
      responsesWithoutHash.every((version) => /\(.*\)/.test(version)),
    ).toBe(true);
  });

  it('returns no hash if not requested', async () => {
    mockRSSFeeds({ stable: Unity3dDatasource.streams.stable });
    const responsesWithoutHash = (
      await getPkgReleases({
        datasource: Unity3dDatasource.id,
        packageName: 'm_EditorVersion',
        registryUrls: [Unity3dDatasource.streams.stable],
      })
    )?.releases.map((release) => release.version);

    expect(responsesWithoutHash!.length).toBeGreaterThan(0);
    expect(
      responsesWithoutHash!.every((version) => !/\(.*\)/.test(version)),
    ).toBe(true);
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
    const responses = (await getPkgReleases({
      datasource: Unity3dDatasource.id,
      packageName: 'm_EditorVersionWithRevision',
    }))!.releases.map((release) => release.version);

    expect(responses.every((version) => /[fp]/.test(version))).toBe(true);
  });
});

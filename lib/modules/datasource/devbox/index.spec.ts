import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';

const packageName = 'nodejs';

function getPath(packageName: string): string {
  return `/pkg?name=${encodeURIComponent(packageName)}`;
}

const sampleReleases = [
  {
    version: '22.2.0',
    last_updated: '2024-05-22T06:18:38Z',
  },
  {
    version: '22.0.0',
    last_updated: '2024-05-12T16:19:40Z',
  },
  {
    version: '21.7.3',
    last_updated: '2024-04-19T21:36:04Z',
  },
];

describe('modules/datasource/devbox/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(packageName))
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });

  it('returns null for 404', async () => {
    httpMock.scope(defaultRegistryUrl).get(getPath(packageName)).reply(404);
    expect(
      await getPkgReleases({
        datasource,
        packageName,
      }),
    ).toBeNull();
  });

  it('returns null for empty result', async () => {
    httpMock.scope(defaultRegistryUrl).get(getPath(packageName)).reply(200, {});
    expect(
      await getPkgReleases({
        datasource,
        packageName,
      }),
    ).toBeNull();
  });

  it('returns null for empty 200 OK', async () => {
    httpMock
      .scope(defaultRegistryUrl)
      .get(getPath(packageName))
      .reply(200, { versions: [] });
    expect(
      await getPkgReleases({
        datasource,
        packageName,
      }),
    ).toBeNull();
  });

  it('throws for 5xx', async () => {
    httpMock.scope(defaultRegistryUrl).get(getPath(packageName)).reply(502);
    await expect(
      getPkgReleases({
        datasource,
        packageName,
      }),
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });

  it('processes real data', async () => {
    httpMock.scope(defaultRegistryUrl).get(getPath(packageName)).reply(200, {
      name: 'nodejs',
      summary: 'Event-driven I/O framework for the V8 JavaScript engine',
      homepage_url: 'https://nodejs.org',
      license: 'MIT',
      releases: sampleReleases,
    });
    const res = await getPkgReleases({
      datasource,
      packageName,
    });
    expect(res).toEqual({
      homepage: 'https://nodejs.org',
      registryUrl: 'https://search.devbox.sh/v2',
      releases: [
        {
          version: '21.7.3',
          releaseTimestamp: '2024-04-19T21:36:04.000Z',
        },
        {
          version: '22.0.0',
          releaseTimestamp: '2024-05-12T16:19:40.000Z',
        },
        {
          version: '22.2.0',
          releaseTimestamp: '2024-05-22T06:18:38.000Z',
        },
      ],
    });
  });

  it('processes empty data', async () => {
    httpMock.scope(defaultRegistryUrl).get(getPath(packageName)).reply(200, {
      name: 'nodejs',
      summary: 'Event-driven I/O framework for the V8 JavaScript engine',
      homepage_url: 'https://nodejs.org',
      license: 'MIT',
      releases: [],
    });
    const res = await getPkgReleases({
      datasource,
      packageName,
    });
    expect(res).toBeNull();
  });

  it('returns null when no body is returned', async () => {
    httpMock
      .scope(defaultRegistryUrl)
      .get(getPath(packageName))
      .reply(200, undefined);
    const res = await getPkgReleases({
      datasource,
      packageName,
    });
    expect(res).toBeNull();
  });

  it('falls back to a default homepage_url', async () => {
    httpMock.scope(defaultRegistryUrl).get(getPath(packageName)).reply(200, {
      name: 'nodejs',
      summary: 'Event-driven I/O framework for the V8 JavaScript engine',
      homepage_url: undefined,
      license: 'MIT',
      releases: sampleReleases,
    });
    const res = await getPkgReleases({
      datasource,
      packageName,
    });
    expect(res?.homepage).toBeUndefined();
  });
});

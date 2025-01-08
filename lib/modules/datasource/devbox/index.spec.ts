import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';

const packageName = 'nodejs';

function getPath(packageName: string): string {
  return `/pkg?name=${packageName}`;
}

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
    httpMock
      .scope(defaultRegistryUrl)
      .get(getPath(packageName))
      .reply(200, {
        name: 'nodejs',
        summary: 'Event-driven I/O framework for the V8 JavaScript engine',
        homepage_url: 'https://nodejs.org',
        license: 'MIT',
        releases: [
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
        ],
      });
    const res = await getPkgReleases({
      datasource,
      packageName,
    });
    expect(res?.homepage).toBe('https://nodejs.org');
    expect(res?.releases[0]).toEqual({
      version: '21.7.3',
      releaseTimestamp: '2024-04-19T21:36:04.000Z',
    });
    expect(res?.releases).toHaveLength(3);
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
});

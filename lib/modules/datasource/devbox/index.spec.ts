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
          {
            version: '21.7.2',
            last_updated: '2024-04-05T14:44:07Z',
          },
          {
            version: '21.7.1',
            last_updated: '2024-04-02T02:53:36Z',
          },
          {
            version: '21.7.0',
            last_updated: '2024-03-08T13:51:52Z',
          },
          {
            version: '21.6.2',
            last_updated: '2024-02-24T23:06:34Z',
          },
          {
            version: '21.6.1',
            last_updated: '2024-02-10T18:15:24Z',
          },
          {
            version: '21.6.0',
            last_updated: '2024-01-17T15:31:30Z',
          },
          {
            version: '21.5.0',
            last_updated: '2024-01-14T03:55:27Z',
          },
          {
            version: '21.4.0',
            last_updated: '2023-12-18T02:58:18Z',
          },
          {
            version: '21.3.0',
            last_updated: '2023-12-13T22:54:10Z',
          },
          {
            version: '21.2.0',
            last_updated: '2023-11-17T14:14:56Z',
          },
          {
            version: '21.1.0',
            last_updated: '2023-10-25T20:49:13Z',
          },
          {
            version: '21.0.0',
            last_updated: '2023-10-21T11:05:41Z',
          },
          {
            version: '20.12.2',
            last_updated: '2024-05-22T06:18:38Z',
          },
          {
            version: '20.11.1',
            last_updated: '2024-04-02T02:53:36Z',
          },
          {
            version: '20.11.0',
            last_updated: '2024-02-10T18:15:24Z',
          },
          {
            version: '20.10.0',
            last_updated: '2024-01-14T03:55:27Z',
          },
        ],
      });
    const res = await getPkgReleases({
      datasource,
      packageName,
    });
    expect(res?.homepage).toBe('https://nodejs.org');
    expect(res?.releases[0]).toStrictEqual({
      version: '20.10.0',
      releaseTimestamp: '2024-01-14T03:55:27.000Z',
    });
    expect(res?.releases).toHaveLength(19);
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

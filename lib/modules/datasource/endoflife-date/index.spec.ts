import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { registryUrl } from './common';
import { EndoflifeDatePackagesource } from './index';

const datasource = EndoflifeDatePackagesource.id;

const packageName = 'amazon-eks';

// Prefixed with '/' and suffixed with '.json' since this is the URL we generate in getReleases.
const mockPath = `/${packageName}.json`;
const fixtureAmazonEks = Fixtures.getJson(`eks.json`);

describe('modules/datasource/endoflife-date/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      httpMock.scope(registryUrl).get(mockPath).reply(200, fixtureAmazonEks);
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toEqual({
        registryUrl: 'https://endoflife.date/api',
        releases: [
          {
            releaseTimestamp: '2020-10-13T00:00:00.000Z',
            version: '1.18',
          },
          {
            releaseTimestamp: '2021-02-16T00:00:00.000Z',
            version: '1.19',
          },
          {
            releaseTimestamp: '2021-05-18T00:00:00.000Z',
            version: '1.20',
          },
          {
            releaseTimestamp: '2021-07-19T00:00:00.000Z',
            version: '1.21',
          },
          {
            releaseTimestamp: '2022-04-04T00:00:00.000Z',
            version: '1.22',
          },
          {
            releaseTimestamp: '2022-08-11T00:00:00.000Z',
            version: '1.23',
          },
          {
            releaseTimestamp: '2022-11-15T00:00:00.000Z',
            version: '1.24',
          },
          {
            releaseTimestamp: '2023-02-21T00:00:00.000Z',
            version: '1.25',
          },
          {
            releaseTimestamp: '2023-04-11T00:00:00.000Z',
            version: '1.26',
          },
        ],
      });
      expect(res?.releases).toHaveLength(9);
    });

    it('returns null without registryUrl', async () => {
      const endoflifeDateDatasource = new EndoflifeDatePackagesource();
      const res = await endoflifeDateDatasource.getReleases({
        registryUrl: '',
        packageName,
      });
      expect(res).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(registryUrl).get(mockPath).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        })
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(registryUrl).get(mockPath).reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        })
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(registryUrl).get(mockPath).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });
});

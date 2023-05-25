import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { registryUrl } from './common';
import { EndoflifeDatePackagesource } from './index';

const datasource = EndoflifeDatePackagesource.id;

// Default package name and mock path to test with
const packageName = 'amazon-eks';
const eksMockPath = `/${packageName}.json`;

const fixtureAmazonEks = Fixtures.getJson(`eks.json`);
const fixtureApacheCassandra = Fixtures.getJson(`apache-cassandra.json`);

describe('modules/datasource/endoflife-date/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      httpMock.scope(registryUrl).get(eksMockPath).reply(200, fixtureAmazonEks);
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toEqual({
        registryUrl: 'https://endoflife.date/api',
        releases: [
          {
            isDeprecated: true,
            releaseTimestamp: '2020-10-13T00:00:00.000Z',
            version: '1.18-eks-13',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2021-02-16T00:00:00.000Z',
            version: '1.19-eks-11',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2021-05-18T00:00:00.000Z',
            version: '1.20-eks-14',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2021-07-19T00:00:00.000Z',
            version: '1.21-eks-17',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-04-04T00:00:00.000Z',
            version: '1.22-eks-12',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-08-11T00:00:00.000Z',
            version: '1.23-eks-8',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-11-15T00:00:00.000Z',
            version: '1.24-eks-6',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2023-02-21T00:00:00.000Z',
            version: '1.25-eks-3',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2023-04-11T00:00:00.000Z',
            version: '1.26-eks-1',
          },
        ],
      });
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
      httpMock.scope(registryUrl).get(eksMockPath).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        })
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(registryUrl).get(eksMockPath).reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        })
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(registryUrl).get(eksMockPath).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('detects discontinuation', async () => {
      httpMock
        .scope(registryUrl)
        .get('/apache-cassandra.json')
        .reply(200, fixtureApacheCassandra);
      const res = await getPkgReleases({
        datasource,
        packageName: 'apache-cassandra',
      });
      expect(res).toEqual({
        registryUrl: 'https://endoflife.date/api',
        releases: [
          {
            isDeprecated: true,
            releaseTimestamp: '2015-11-09T00:00:00.000Z',
            version: '3.0.29',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2017-06-23T00:00:00.000Z',
            version: '3.11.15',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2021-07-26T00:00:00.000Z',
            version: '4.0.9',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-12-13T00:00:00.000Z',
            version: '4.1.1',
          },
        ],
      });
    });
  });
});

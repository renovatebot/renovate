import { DateTime, Settings } from 'luxon';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { registryUrl } from './common';
import { EndoflifeDateAwsLambdaPackagesource } from './index';

const datasource = EndoflifeDateAwsLambdaPackagesource.id;

// Default package name and mock path to test with
const awsLambdaMockPath = `/aws-lambda.json`;

describe('modules/datasource/endoflife-date-aws-lambda/index', () => {
  beforeAll(() => {
    const now = DateTime.fromISO('2023-06-03');
    Settings.now = () => now.valueOf();
  });

  describe('getReleases', () => {
    it('processes real data for nodejs', async () => {
      httpMock
        .scope(registryUrl)
        .get(awsLambdaMockPath)
        .reply(200, Fixtures.getJson(`aws-lambda.json`));
      const res = await getPkgReleases({
        datasource,
        packageName: 'nodejs',
      });
      expect(res).toEqual({
        registryUrl: 'https://endoflife.date/api',
        releases: [
          {
            isDeprecated: true,
            releaseTimestamp: '2016-04-07T00:00:00.000Z',
            version: '4.3-edge',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2017-03-22T00:00:00.000Z',
            version: '6.10',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2018-04-02T00:00:00.000Z',
            version: '8.10',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2019-05-15T00:00:00.000Z',
            version: '10.x',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2019-11-18T00:00:00.000Z',
            version: '12.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-05-12T00:00:00.000Z',
            version: '16.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-11-18T00:00:00.000Z',
            version: '18.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2023-11-15T00:00:00.000Z',
            version: '20.x',
          },
        ],
      });
    });

    it('processes real data for python', async () => {
      httpMock
        .scope(registryUrl)
        .get(awsLambdaMockPath)
        .reply(200, Fixtures.getJson(`aws-lambda.json`));
      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
      });
      expect(res).toEqual({
        registryUrl: 'https://endoflife.date/api',
        releases: [
          {
            isDeprecated: true,
            releaseTimestamp: '2015-10-08T00:00:00.000Z',
            version: '2.7',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2017-04-18T00:00:00.000Z',
            version: '3.6',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2018-11-19T00:00:00.000Z',
            version: '3.7',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2019-11-18T00:00:00.000Z',
            version: '3.8',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2021-08-16T00:00:00.000Z',
            version: '3.9',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2023-04-18T00:00:00.000Z',
            version: '3.10',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2023-07-27T00:00:00.000Z',
            version: '3.11',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2023-12-14T00:00:00.000Z',
            version: '3.12',
          },
        ],
      });
    });

    it('returns null without registryUrl', async () => {
      const endoflifeDateDatasource = new EndoflifeDateAwsLambdaPackagesource();
      const res = await endoflifeDateDatasource.getReleases({
        registryUrl: '',
        packageName: 'nodejs',
      });
      expect(res).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(registryUrl).get(awsLambdaMockPath).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'nodejs',
        }),
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(registryUrl).get(awsLambdaMockPath).reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'nodejs',
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(registryUrl).get(awsLambdaMockPath).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'nodejs',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('detects boolean discontinuation', async () => {
      httpMock
        .scope(registryUrl)
        .get(awsLambdaMockPath)
        .reply(200, Fixtures.getJson(`aws-lambda.json`));
      const res = await getPkgReleases({
        datasource,
        packageName: 'nodejs',
      });
      expect(res).toEqual({
        registryUrl: 'https://endoflife.date/api',
        releases: [
          {
            isDeprecated: true,
            releaseTimestamp: '2016-04-07T00:00:00.000Z',
            version: '4.3-edge',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2017-03-22T00:00:00.000Z',
            version: '6.10',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2018-04-02T00:00:00.000Z',
            version: '8.10',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2019-05-15T00:00:00.000Z',
            version: '10.x',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2019-11-18T00:00:00.000Z',
            version: '12.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-05-12T00:00:00.000Z',
            version: '16.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-11-18T00:00:00.000Z',
            version: '18.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2023-11-15T00:00:00.000Z',
            version: '20.x',
          },
        ],
      });
    });

    it('detects date discontinuation', async () => {
      httpMock
        .scope(registryUrl)
        .get(awsLambdaMockPath)
        .reply(200, Fixtures.getJson(`aws-lambda.json`));
      const res = await getPkgReleases({
        datasource,
        packageName: 'nodejs',
      });
      expect(res).toEqual({
        registryUrl: 'https://endoflife.date/api',
        releases: [
          {
            isDeprecated: true,
            releaseTimestamp: '2016-04-07T00:00:00.000Z',
            version: '4.3-edge',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2017-03-22T00:00:00.000Z',
            version: '6.10',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2018-04-02T00:00:00.000Z',
            version: '8.10',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2019-05-15T00:00:00.000Z',
            version: '10.x',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2019-11-18T00:00:00.000Z',
            version: '12.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-05-12T00:00:00.000Z',
            version: '16.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2022-11-18T00:00:00.000Z',
            version: '18.x',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2023-11-15T00:00:00.000Z',
            version: '20.x',
          },
        ],
      });
    });
  });
});

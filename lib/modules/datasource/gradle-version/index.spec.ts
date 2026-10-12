import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { id as versioning } from '../../versioning/gradle/index.ts';
import type { GetPkgReleasesConfig, GetReleasesConfig } from '../index.ts';
import { getPkgReleases } from '../index.ts';
import { GradleVersionDatasource } from './index.ts';

const allResponse = Fixtures.get('all.json');

let config: GetPkgReleasesConfig;

const datasource = GradleVersionDatasource.id;

describe('modules/datasource/gradle-version/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      config = {
        datasource,
        versioning,
        packageName: 'abc',
      };
    });

    it('processes real data', async () => {
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(200, allResponse);
      const res = await getPkgReleases(config);
      expect(res).toEqual({
        homepage: 'https://gradle.org',
        sourceUrl: 'https://github.com/gradle/gradle',
        registryUrl: 'https://services.gradle.org/versions/all',
        releases: [
          {
            version: '0.7',
            gitRef: 'v0.7.0',
            releaseTimestamp: '2009-07-20T06:50:13.000Z',
          },
          {
            version: '0.8',
            gitRef: 'v0.8.0',
            releaseTimestamp: '2009-09-28T12:01:59.000Z',
          },
          {
            version: '0.9-rc-1',
            gitRef: 'v0.9.0-RC1',
            releaseTimestamp: '2010-08-03T21:04:33.000Z',
          },
          {
            version: '0.9.1',
            gitRef: 'v0.9.1',
            releaseTimestamp: '2011-01-02T00:40:57.000Z',
          },
          {
            version: '1.0-milestone-4',
            gitRef: 'v1.0.0-M4',
            isDeprecated: true,
            releaseTimestamp: '2011-07-28T08:38:22.000Z',
          },
          {
            version: '1.0-milestone-8a',
            gitRef: 'v1.0.0-M8a',
            releaseTimestamp: '2012-02-20T17:53:57.000Z',
          },
          {
            version: '6.8.3',
            gitRef: 'v6.8.3',
            releaseTimestamp: '2021-02-22T16:13:28.000Z',
          },
          {
            version: '7.0-milestone-3',
            gitRef: 'v7.0.0-M3',
            releaseTimestamp: '2021-03-13T01:03:21.000Z',
          },
          {
            version: '7.0-rc-1',
            gitRef: 'v7.0.0-RC1',
            releaseTimestamp: '2021-03-23T01:02:30.000Z',
          },
        ],
      });
    });

    it('calls configured registryUrls', async () => {
      httpMock.scope('https://foo.bar').get('/').reply(200, allResponse);

      httpMock
        .scope('http://baz.qux')
        .get('/')
        .reply(200, [
          { version: '1.0.1' },
          { version: '1.0.2', buildTime: 'abc' },
        ]);

      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://foo.bar', 'http://baz.qux'],
      });
      expect(res).toEqual({
        homepage: 'https://gradle.org',
        sourceUrl: 'https://github.com/gradle/gradle',
        releases: [
          {
            version: '0.7',
            gitRef: 'v0.7.0',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2009-07-20T06:50:13.000Z',
          },
          {
            version: '0.8',
            gitRef: 'v0.8.0',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2009-09-28T12:01:59.000Z',
          },
          {
            version: '0.9-rc-1',
            gitRef: 'v0.9.0-RC1',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2010-08-03T21:04:33.000Z',
          },
          {
            version: '0.9.1',
            gitRef: 'v0.9.1',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2011-01-02T00:40:57.000Z',
          },
          {
            version: '1.0-milestone-4',
            gitRef: 'v1.0.0-M4',
            isDeprecated: true,
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2011-07-28T08:38:22.000Z',
          },
          {
            version: '1.0-milestone-8a',
            gitRef: 'v1.0.0-M8a',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2012-02-20T17:53:57.000Z',
          },
          {
            version: '1.0.1',
            gitRef: 'v1.0.1',
            registryUrl: 'http://baz.qux',
          },
          {
            version: '1.0.2',
            gitRef: 'v1.0.2',
            registryUrl: 'http://baz.qux',
          },
          {
            version: '6.8.3',
            gitRef: 'v6.8.3',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2021-02-22T16:13:28.000Z',
          },
          {
            version: '7.0-milestone-3',
            gitRef: 'v7.0.0-M3',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2021-03-13T01:03:21.000Z',
          },
          {
            version: '7.0-rc-1',
            gitRef: 'v7.0.0-RC1',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2021-03-23T01:02:30.000Z',
          },
        ],
      });
    });

    it('handles empty releases', async () => {
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(200, []);

      const res = await getPkgReleases(config);
      expect(res).toBeNull();
    });

    it('handles errors', async () => {
      expect.assertions(2);
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(500);

      httpMock.scope('http://baz.qux').get('/').reply(429);

      const gradleVersionDatasource = new GradleVersionDatasource();

      await expect(
        gradleVersionDatasource.getReleases(
          partial<GetReleasesConfig>({
            registryUrl: 'https://services.gradle.org/versions/all',
          }),
        ),
      ).rejects.toThrow(ExternalHostError);

      await expect(
        gradleVersionDatasource.getReleases(
          partial<GetReleasesConfig>({
            registryUrl: 'http://baz.qux',
          }),
        ),
      ).rejects.toThrow(ExternalHostError);
    });
  });
});

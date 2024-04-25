import { GetPkgReleasesConfig, GetReleasesConfig, getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { partial } from '../../../../test/util';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { id as versioning } from '../../versioning/gradle';
import { GradleVersionDatasource } from '.';

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
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res?.releases).toHaveLength(300);
      expect(
        res?.releases.filter(({ isDeprecated }) => isDeprecated),
      ).toHaveLength(1);
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
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
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

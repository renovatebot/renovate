import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { GalaxyDatasource } from './index.ts';

const baseUrl = 'https://galaxy.ansible.com/';
const customBaseUrl = 'https://artifactory.example.com';

describe('modules/datasource/galaxy/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200);
      await expect(
        getPkgReleases({
          datasource: GalaxyDatasource.id,
          packageName: 'non_existent_crate',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for missing fields', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200, undefined);
      await expect(
        getPkgReleases({
          datasource: GalaxyDatasource.id,
          packageName: 'non_existent_crate',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for empty list', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200, '\n');
      await expect(
        getPkgReleases({
          datasource: GalaxyDatasource.id,
          packageName: 'non_existent_crate',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=some_crate&name=undefined')
        .reply(404);
      await expect(
        getPkgReleases({
          datasource: GalaxyDatasource.id,
          packageName: 'some_crate',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=some_crate&name=undefined')
        .replyWithError('some unknown error');
      await expect(
        getPkgReleases({
          datasource: GalaxyDatasource.id,
          packageName: 'some_crate',
        }),
      ).resolves.toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=yatesr&name=timezone')
        .reply(200, Fixtures.get('timezone.json'));
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        packageName: 'yatesr.timezone',
      });
      expect(res).toEqual({
        dependencyUrl: 'https://galaxy.ansible.com/yatesr/timezone',
        registryUrl: 'https://galaxy.ansible.com',
        releases: [
          {
            releaseTimestamp: '2015-11-17T00:47:51.891Z',
            version: '1.0.0',
          },
          {
            releaseTimestamp: '2017-09-25T00:31:23.862Z',
            version: '1.1.0',
          },
          {
            releaseTimestamp: '2019-10-28T01:51:11.502Z',
            version: '1.2.0',
          },
        ],
        sourceUrl: 'https://github.com/yatesr/ansible-timezone',
      });
    });

    it('omits the source url if the github fields are empty', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=yatesr&name=timezone')
        .reply(200, {
          results: [
            {
              id: 1,
              github_user: '',
              github_repo: '',
              summary_fields: {
                versions: [{ name: '1.0.0', release_date: null }],
              },
            },
          ],
        });
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        packageName: 'yatesr.timezone',
      });
      expect(res).toEqual({
        dependencyUrl: 'https://galaxy.ansible.com/yatesr/timezone',
        registryUrl: 'https://galaxy.ansible.com',
        releases: [{ version: '1.0.0' }],
      });
    });

    it('handles multiple results when one user matches exactly', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=datadog&name=datadog')
        .reply(200, Fixtures.get('datadog.json'));
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        packageName: 'datadog.datadog',
      });
      expect(res).not.toBeNull();
      expect(res?.releases).toHaveLength(11);
    });

    it('rejects multiple results when no user matches exactly', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=nope&name=nope')
        .reply(200, Fixtures.get('datadog.json'));
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        packageName: 'nope.nope',
      });
      expect(res).toBeNull();
    });

    it('return null if searching random username and project name', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=foo&name=bar')
        .reply(200, Fixtures.get('empty'));
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        packageName: 'foo.bar',
      });
      expect(res).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=some_crate&name=undefined')
        .reply(502);
      await expect(
        getPkgReleases({
          datasource: GalaxyDatasource.id,
          packageName: 'some_crate',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=foo&name=bar')
        .reply(404);
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        packageName: 'foo.bar',
      });
      expect(res).toBeNull();
    });

    it('supports a custom registry with a path prefix', async () => {
      httpMock
        .scope(customBaseUrl)
        .get(
          '/artifactory/api/ansible/ansible-remote/api/v1/roles/?owner__username=yatesr&name=timezone',
        )
        .reply(200, Fixtures.get('timezone.json'));
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        packageName: 'yatesr.timezone',
        registryUrls: [
          `${customBaseUrl}/artifactory/api/ansible/ansible-remote/`,
        ],
      });
      expect(res?.releases).not.toBeEmpty();
      expect(res?.dependencyUrl).toBeUndefined();
    });

    it('hunts through registries until a role is found', async () => {
      httpMock
        .scope(customBaseUrl)
        .get('/api/v1/roles/?owner__username=yatesr&name=timezone')
        .reply(200, Fixtures.get('empty'));
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=yatesr&name=timezone')
        .reply(200, Fixtures.get('timezone.json'));
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        packageName: 'yatesr.timezone',
        registryUrls: [customBaseUrl, baseUrl],
      });
      expect(res?.releases).not.toBeEmpty();
      expect(res?.dependencyUrl).toBe(
        'https://galaxy.ansible.com/yatesr/timezone',
      );
    });
  });
});

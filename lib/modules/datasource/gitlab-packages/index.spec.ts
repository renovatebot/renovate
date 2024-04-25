import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource } from './common';

describe('modules/datasource/gitlab-packages/index', () => {
  describe('getReleases', () => {
    it('returns package from custom registry', async () => {
      const body = [
        {
          version: '1.0.0',
          created_at: '2020-03-04T12:01:37.000-06:00',
          name: 'mypkg',
        },
        {
          version: 'v1.1.0',
          created_at: '2020-04-04T12:01:37.000-06:00',
          name: 'mypkg',
        },
        {
          version: 'v1.1.1',
          created_at: '2020-05-04T12:01:37.000-06:00',
          name: 'mypkg',
        },
        {
          version: 'v2.0.0',
          created_at: '2020-05-04T12:01:37.000-06:00',
          name: 'otherpkg',
        },
      ];
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/user%2Fproject1/packages')
        .query({
          package_name: 'mypkg',
          per_page: '100',
        })
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://gitlab.com'],
        packageName: 'user/project1:mypkg',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(3);
    });

    it('returns null for 404', async () => {
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/user%2Fproject1/packages')
        .query({
          package_name: 'mypkg',
          per_page: '100',
        })
        .reply(404);
      expect(
        await getPkgReleases({
          datasource,
          registryUrls: ['https://gitlab.com'],
          packageName: 'user/project1:mypkg',
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/user%2Fproject1/packages')
        .query({
          package_name: 'mypkg',
          per_page: '100',
        })
        .reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          registryUrls: ['https://gitlab.com'],
          packageName: 'user/project1:mypkg',
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/user%2Fproject1/packages')
        .query({
          package_name: 'mypkg',
          per_page: '100',
        })
        .reply(502);
      await expect(
        getPkgReleases({
          datasource,
          registryUrls: ['https://gitlab.com'],
          packageName: 'user/project1:mypkg',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });
});

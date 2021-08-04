import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { datasource } from './common';

describe(getName(), () => {
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
          _links: {
            web_path: '/user/project1/-/packages/3',
          },
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
        registryUrls: ['https://gitlab.com/user/project1'],
        depName: 'mypkg',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

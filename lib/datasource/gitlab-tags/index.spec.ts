import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { id as datasource } from '.';

describe(getName(__filename), () => {
  beforeEach(() => {
    httpMock.reset();
    httpMock.setup();
  });
  afterEach(() => {
    httpMock.reset();
  });
  describe('getReleases', () => {
    it('returns tags from custom registry', async () => {
      const body = [
        {
          name: 'v1.0.0',
          commit: {
            created_at: '2020-03-04T12:01:37.000-06:00',
          },
        },
        {
          name: 'v1.1.0',
          commit: {},
        },
        {
          name: 'v1.1.1',
        },
      ];
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/tags?per_page=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        depName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns tags with default registry', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/some%2Fdep2/repository/tags?per_page=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        depName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

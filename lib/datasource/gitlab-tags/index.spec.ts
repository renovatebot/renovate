import * as httpMock from '../../../test/httpMock';
import * as gitlab from '.';

describe('datasource/gitlab-tags', () => {
  beforeEach(() => {
    httpMock.reset();
    httpMock.setup();
  });
  describe('getReleases', () => {
    it('returns tags', async () => {
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
        .get('/api/v4/api/v4/projects/some%2Fdep2/repository/tags?per_page=100')
        .reply(200, body);
      const res = await gitlab.getReleases({
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        lookupName: 'some/dep2',
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
      const res = await gitlab.getReleases({
        lookupName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

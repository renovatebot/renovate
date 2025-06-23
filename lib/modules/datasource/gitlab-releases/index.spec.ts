import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { GitlabReleasesDatasource } from '.';

describe('modules/datasource/gitlab-releases/index', () => {
  describe('getReleases', () => {
    const body = [
      {
        tag_name: 'v1.0.0',
        released_at: '2021-01-01T00:00:00.000Z',
      },
      {
        tag_name: 'v1.1.0',
        released_at: '2021-03-01T00:00:00.000Z',
      },
    ];

    it('returns releases from custom registry', async () => {
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/releases')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource: GitlabReleasesDatasource.id,
        registryUrls: ['https://gitlab.company.com'],
        packageName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(2);
    });

    it('returns releases from default registry', async () => {
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/some%2Fdep2/releases')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource: GitlabReleasesDatasource.id,
        packageName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(2);
    });

    it('return null if not found', async () => {
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/some%2Fdep2/releases')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: GitlabReleasesDatasource.id,
          packageName: 'some/dep2',
        }),
      ).toBeNull();
    });
  });
});

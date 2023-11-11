import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { GitlabTagsDatasource } from '.';

const datasource = GitlabTagsDatasource.id;

describe('modules/datasource/gitlab-tags/index', () => {
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
        packageName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(3);
    });

    it('returns tags from custom registry in sub path', async () => {
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
        .scope('https://my.company.com/gitlab')
        .get('/api/v4/projects/some%2Fdep2/repository/tags?per_page=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://my.company.com/gitlab'],
        packageName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(3);
    });

    it('returns tags with default registry', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/some%2Fdep2/repository/tags?per_page=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(2);
    });
  });

  describe('getDigest', () => {
    it('returns commits from gitlab installation', async () => {
      const digest = 'abcd00001234';
      const body = [
        {
          id: digest,
        },
      ];
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits?per_page=1')
        .reply(200, body);
      const res = await getDigest({
        datasource,
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        packageName: 'some/dep2',
      });
      expect(res).toBe(digest);
    });

    it('returns commits from gitlab installation for a specific branch', async () => {
      const digest = 'abcd00001234';
      const body = {
        id: digest,
      };
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits/branch')
        .reply(200, body);
      const res = await getDigest(
        {
          datasource,
          registryUrls: ['https://gitlab.company.com/api/v4/'],
          packageName: 'some/dep2',
        },
        'branch',
      );
      expect(res).toBe(digest);
    });

    it('returns null from gitlab installation with no commits', async () => {
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits?per_page=1')
        .reply(200, []);
      const res = await getDigest({
        datasource,
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        packageName: 'some/dep2',
      });
      expect(res).toBeNull();
    });

    it('returns null from gitlab installation with unknown branch', async () => {
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits/unknown-branch')
        .reply(404, '}');
      const res = await getDigest(
        {
          datasource,
          registryUrls: ['https://gitlab.company.com/api/v4/'],
          packageName: 'some/dep2',
        },
        'unknown-branch',
      );
      expect(res).toBeNull();
    });
  });
});

import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { BitbucketTagsDatasource } from '.';

const datasource = BitbucketTagsDatasource.id;

describe('modules/datasource/bitbucket-tags/index', () => {
  describe('getReleases', () => {
    it('returns tags from bitbucket cloud', async () => {
      const body = {
        pagelen: 3,
        values: [
          {
            name: 'v1.0.0',
            target: {
              date: '2020-11-19T09:05:35+00:00',
            },
          },
          {
            name: 'v1.1.0',
            target: {},
          },
          {
            name: 'v1.1.1',
          },
        ],
        page: 1,
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/refs/tags?pagelen=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(3);
    });
  });

  describe('getDigest', () => {
    it('returns commits from bitbucket cloud', async () => {
      const body = {
        pagelen: 3,
        values: [
          {
            hash: '123',
            date: '2020-11-19T09:05:35+00:00',
          },
          {
            hash: '133',
            date: '2020-11-19T09:05:36+00:00',
          },
          {
            hash: '333',
            date: '2020-11-19T09:05:37+00:00',
          },
        ],
        page: 1,
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2')
        .reply(200, {
          mainbranch: { name: 'master' },
          uuid: '123',
          full_name: 'some/repo',
        });
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/commits/master')
        .reply(200, body);
      const res = await getDigest({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res).toBeString();
      expect(res).toBe('123');
    });
  });

  describe('getDigest with no commits', () => {
    it('returns commits from bitbucket cloud', async () => {
      const body = {
        pagelen: 0,
        values: [],
        page: 1,
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2')
        .reply(200, {
          mainbranch: { name: 'master' },
          uuid: '123',
          full_name: 'some/repo',
        });
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/commits/master')
        .reply(200, body);
      const res = await getDigest({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toBeNull();
    });
  });

  describe('getTagCommit', () => {
    it('returns tags commit hash from bitbucket cloud', async () => {
      const body = {
        name: 'v1.0.0',
        target: {
          date: '2020-11-19T09:05:35+00:00',
          hash: '123',
        },
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/refs/tags/v1.0.0')
        .reply(200, body);
      const res = await getDigest(
        {
          datasource,
          packageName: 'some/dep2',
        },
        'v1.0.0',
      );
      expect(res).toMatchSnapshot();
      expect(res).toBeString();
      expect(res).toBe('123');
    });

    it('returns null for missing hash', async () => {
      const body = {
        name: 'v1.0.0',
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/refs/tags/v1.0.0')
        .reply(200, body);
      const res = await getDigest(
        {
          datasource,
          packageName: 'some/dep2',
        },
        'v1.0.0',
      );
      expect(res).toBeNull();
    });
  });
});

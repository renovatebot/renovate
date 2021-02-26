import { getDigest, getPkgReleases } from '..';
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
        .get('/2.0/repositories/some/dep2/refs/tags')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        depName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        .reply(200, { mainbranch: { name: 'master' } });
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/commits/master')
        .reply(200, body);
      const res = await getDigest({
        datasource,
        depName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res).toBeString();
      expect(res).toEqual('123');
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        .reply(200, { mainbranch: { name: 'master' } });
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/commits/master')
        .reply(200, body);
      const res = await getDigest({
        datasource,
        depName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          depName: 'some/dep2',
        },
        'v1.0.0'
      );
      expect(res).toMatchSnapshot();
      expect(res).toBeString();
      expect(res).toEqual('123');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

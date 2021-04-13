import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import * as rubyVersioning from '../../versioning/ruby';
import * as pod from '.';

const config = {
  versioning: rubyVersioning.id,
  datasource: pod.id,
  depName: 'foo',
  registryUrls: [],
};

const githubApiHost = 'https://api.github.com';
const cocoapodsHost = 'https://cdn.cocoapods.org';

describe(getName(__filename), () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('returns null for invalid inputs', async () => {
      expect(
        await getPkgReleases({
          datasource: pod.id,
          depName: 'foobar',
          registryUrls: [],
        })
      ).toBeNull();
    });
    it('returns null for empty result', async () => {
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('returns null for 404', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/foo/bar/contents/Specs/foo')
        .reply(404)
        .get('/repos/foo/bar/contents/Specs/a/c/b/foo')
        .reply(404);
      const res = await getPkgReleases({
        ...config,
        registryUrls: [...config.registryUrls, 'https://github.com/foo/bar'],
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 401', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .reply(401);
      expect(await getPkgReleases(config)).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 429', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .reply(429);
      await expect(getPkgReleases(config)).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .replyWithError('foobar');
      expect(await getPkgReleases(config)).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data from CDN', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .reply(200, 'foo/1.2.3');
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: ['https://github.com/CocoaPods/Specs'],
        })
      ).toEqual({
        registryUrl: 'https://github.com/CocoaPods/Specs',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data from Github', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/Artsy/Specs/contents/Specs/foo')
        .reply(404)
        .get('/repos/Artsy/Specs/contents/Specs/a/c/b/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.com/Artsy/Specs'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.com/Artsy/Specs',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

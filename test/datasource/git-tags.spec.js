const { getRemoteInfo } = require('isomorphic-git');
const { getPkgReleases } = require('../../lib/datasource/git-tags');

jest.mock('isomorphic-git');

const lookupName = 'vapor';
const registryUrls = ['https://github.com/vapor/vapor.git'];

describe('datasource/git-tags', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getPkgReleases', () => {
    it('returns nil if response is wrong', async () => {
      getRemoteInfo.mockReturnValue(Promise.resolve(null));
      const versions = await getPkgReleases({ lookupName, registryUrls });
      expect(versions).toEqual(null);
    });
    it('returns nil if remote call throws exception', async () => {
      getRemoteInfo.mockImplementation(() => {
        throw new Error();
      });
      const versions = await getPkgReleases({ lookupName, registryUrls });
      expect(versions).toEqual(null);
    });
    it('returns versions filtered from tags', async () => {
      getRemoteInfo.mockReturnValue(
        Promise.resolve({
          refs: {
            tags: {
              '0.0.1': 'foo',
              'v0.0.2': 'bar',
              'v0.0.2^{}': 'baz',
            },
          },
        })
      );
      const versions = await getPkgReleases({ lookupName, registryUrls });
      const result = versions.releases.map(x => x.version).sort();
      expect(result).toEqual(['0.0.1', '0.0.2']);
    });
  });
});

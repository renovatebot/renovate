import _simpleGit from 'simple-git/promise';
import { getPkgReleases, getDigest } from '../../lib/datasource/git-submodules';

jest.mock('simple-git/promise.js');
const simpleGit: any = _simpleGit;

const lookupName = 'https://github.com/example/example.git';
const registryUrls = [lookupName, 'master'];

describe('datasource/git-submoduless', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getPkgReleases', () => {
    it('returns null if response is wrong', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(null);
        },
      });
      const versions = await getPkgReleases({ lookupName, registryUrls });
      expect(versions).toEqual(null);
    });
    it('returns null if remote call throws exception', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          throw new Error();
        },
      });
      const versions = await getPkgReleases({ lookupName, registryUrls });
      expect(versions).toEqual(null);
    });
    it('returns versions filtered from tags', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve('commithash1\trefs/heads/master');
        },
      });

      const versions = await getPkgReleases({
        lookupName,
        registryUrls,
      });
      const result = versions.releases.map(x => x.version).sort();
      expect(result).toEqual(['commithash1']);
    });
  });
  describe('getDigest', () => {
    it('returns null if passed null', async () => {
      const digest = await getDigest({}, null);
      expect(digest).toBeNull();
    });
    it('returns value if passed value', async () => {
      const commitHash = 'commithash1';
      const digest = await getDigest({}, commitHash);
      expect(digest).toEqual(commitHash);
    });
  });
});

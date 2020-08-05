import _simpleGit from 'simple-git';
import { getPkgReleases } from '..';
import { id as versioning } from '../../versioning/git';
import { id as datasource, getDigest } from '.';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

const depName = 'https://github.com/example/example.git';
const registryUrls = [depName, 'master'];

describe('datasource/git-submoduless', () => {
  describe('getReleases', () => {
    it('returns null if response is wrong', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(null);
        },
      });
      const versions = await getPkgReleases({
        datasource,
        versioning,
        depName,
        registryUrls,
      });
      expect(versions).toBeNull();
    });
    it('returns null if remote call throws exception', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          throw new Error();
        },
      });
      const versions = await getPkgReleases({
        datasource,
        versioning,
        depName,
        registryUrls,
      });
      expect(versions).toBeNull();
    });
    it('returns versions filtered from tags', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve('commithash1\trefs/heads/master');
        },
      });

      const versions = await getPkgReleases({
        datasource,
        versioning,
        depName,
        registryUrls,
      });
      const result = versions.releases.map((x) => x.version).sort();
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

import _simpleGit from 'simple-git/promise';
import { getDigest, getReleases } from '.';

jest.mock('simple-git/promise');
const simpleGit: any = _simpleGit;

const lookupName = 'https://github.com/example/example.git';

describe('datasource/git-tags', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(null);
        },
      });
      const versions = await getReleases({ lookupName });
      expect(versions).toEqual(null);
    });
    it('returns nil if remote call throws exception', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          throw new Error();
        },
      });
      const versions = await getReleases({ lookupName });
      expect(versions).toEqual(null);
    });
    it('returns versions filtered from tags', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(
            'commithash1\trefs/tags/0.0.1\ncommithash2\trefs/tags/v0.0.2\ncommithash3\trefs/tags/v0.0.2^{}\n'
          );
        },
      });

      const versions = await getReleases({
        lookupName,
      });
      expect(versions).toMatchSnapshot();
    });
  });
  describe('getDigest()', () => {
    it('returns null if not found', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(
            'commithash0\tHEAD\ncommithash1\trefs/tags/0.0.1\ncommithash2\trefs/tags/v0.0.2\ncommithash3\trefs/tags/v0.0.2^{}\ncommithash4\trefs/heads/v0.0.3\ncommithash5\trefs/tags/v0.0.3\n'
          );
        },
      });
      const digest = await getDigest(
        { lookupName: 'a tag to look up' },
        'v1.0.2'
      );
      expect(digest).toBeNull();
    });
    it('returns digest for tag', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(
            'commithash0\tHEAD\ncommithash1\trefs/tags/0.0.1\ncommithash2\trefs/tags/v0.0.2\ncommithash3\trefs/tags/v0.0.2^{}\ncommithash4\trefs/heads/v0.0.3\ncommithash5\trefs/tags/v0.0.3\n'
          );
        },
      });
      const digest = await getDigest(
        { lookupName: 'a tag to look up' },
        'v0.0.2'
      );
      expect(digest).toEqual('commithash2');
    });
    it('returns digest for HEAD', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(
            'commithash0\tHEAD\ncommithash1\trefs/tags/0.0.1\ncommithash2\trefs/tags/v0.0.2\ncommithash3\trefs/tags/v0.0.2^{}\ncommithash4\trefs/heads/v0.0.3\ncommithash5\trefs/tags/v0.0.3\n'
          );
        },
      });
      const digest = await getDigest(
        { lookupName: 'another tag to look up' },
        undefined
      );
      expect(digest).toEqual('commithash0');
    });
  });
});

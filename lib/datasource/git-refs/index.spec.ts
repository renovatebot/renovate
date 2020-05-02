import _simpleGit from 'simple-git/promise';
import { getReleases } from '.';

jest.mock('simple-git/promise');
const simpleGit: any = _simpleGit;

const lookupName = 'https://github.com/example/example.git';

describe('datasource/git-refs', () => {
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
            'commithash1\trefs/tags/0.0.1\ncommithash2\trefs/tags/v0.0.2\ncommithash3\trefs/tags/v0.0.2^{}\ncommithash4\trefs/heads/v0.0.3\ncommithash5\trefs/tags/v0.0.3\n'
          );
        },
      });

      const versions = await getReleases({
        lookupName,
      });
      expect(versions).toMatchSnapshot();
      const result = versions.releases.map((x) => x.version).sort();
      expect(result).toEqual(['0.0.1', 'v0.0.2', 'v0.0.3']);
    });
  });
});

import _simpleGit from 'simple-git';
import { getPkgReleases } from '..';
import { getName, loadFixture } from '../../../test/util';
import { id as datasource, getDigest } from '.';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

const depName = 'https://github.com/example/example.git';

const lsRemote1 = loadFixture(__filename, 'ls-remote-1.txt', '../git-refs');

describe(getName(__filename), () => {
  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(null);
        },
      });
      const versions = await getPkgReleases({ datasource, depName });
      expect(versions).toBeNull();
    });
    it('returns nil if remote call throws exception', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          throw new Error();
        },
      });
      const versions = await getPkgReleases({ datasource, depName });
      expect(versions).toBeNull();
    });
    it('returns versions filtered from tags', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });

      const versions = await getPkgReleases({
        datasource,
        depName,
      });
      expect(versions).toMatchSnapshot();
    });
  });
  describe('getDigest()', () => {
    it('returns null if not found', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await getDigest(
        { datasource, depName: 'a tag to look up' },
        'notfound'
      );
      expect(digest).toBeNull();
    });
    it('returns digest for tag', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await getDigest(
        { datasource, depName: 'a tag to look up' },
        'v1.0.2'
      );
      expect(digest).toMatchSnapshot();
    });
    it('returns digest for HEAD', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await getDigest(
        { datasource, depName: 'another tag to look up' },
        undefined
      );
      expect(digest).toMatchSnapshot();
    });
  });
});

import _simpleGit from 'simple-git';
import { getPkgReleases } from '..';
import { loadFixture } from '../../../test/util';
import { GitRefsDatasource } from '.';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

const depName = 'https://github.com/example/example.git';

const lsRemote1 = loadFixture('ls-remote-1.txt');

const datasource = GitRefsDatasource.id;

describe('datasource/git-refs/index', () => {
  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(null);
        },
      });
      const versions = await getPkgReleases({
        datasource,
        depName,
      });
      expect(versions).toBeNull();
    });
    it('returns nil if response is malformed', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve('aabbccddeeff');
        },
      });
      const { releases } = await getPkgReleases({
        datasource,
        depName,
      });
      expect(releases).toBeEmpty();
    });
    it('returns nil if remote call throws exception', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          throw new Error();
        },
      });
      const versions = await getPkgReleases({
        datasource,
        depName,
      });
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
      const result = versions.releases.map((x) => x.version).sort();
      expect(result).toHaveLength(6);
    });
  });
  describe('getDigest()', () => {
    it('returns null if not found', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await new GitRefsDatasource().getDigest(
        { lookupName: 'a tag to look up' },
        'v2.0.0'
      );
      expect(digest).toBeNull();
    });
    it('returns digest for tag', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await new GitRefsDatasource().getDigest(
        { lookupName: 'a tag to look up' },
        'v1.0.4'
      );
      expect(digest).toMatchSnapshot();
    });
    it('returns digest for HEAD', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await new GitRefsDatasource().getDigest(
        { lookupName: 'another tag to look up' },
        undefined
      );
      expect(digest).toMatchSnapshot();
    });
  });
});

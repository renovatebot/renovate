import _simpleGit, { Response, SimpleGit } from 'simple-git';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import { GitRefsDatasource } from '.';

jest.mock('simple-git');
const simpleGit: jest.Mock<Partial<SimpleGit>> = _simpleGit as never;

const depName = 'https://github.com/example/example.git';

const lsRemote1 = Fixtures.get('ls-remote-1.txt');

const datasource = GitRefsDatasource.id;

describe('modules/datasource/git-refs/index', () => {
  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(null) as Response<string>;
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
          return Promise.resolve('aabbccddeeff') as Response<string>;
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
          return Promise.resolve(lsRemote1) as Response<string>;
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
          return Promise.resolve(lsRemote1) as Response<string>;
        },
      });
      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'v2.0.0'
      );
      expect(digest).toBeNull();
    });
    it('returns digest for tag', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1) as Response<string>;
        },
      });
      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'v1.0.4'
      );
      expect(digest).toMatchSnapshot();
    });
    it('ignores refs/for/', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1) as Response<string>;
        },
      });
      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'master'
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
    });
    it('returns digest for HEAD', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1) as Response<string>;
        },
      });
      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'another tag to look up' },
        undefined
      );
      expect(digest).toMatchSnapshot();
    });
  });
});

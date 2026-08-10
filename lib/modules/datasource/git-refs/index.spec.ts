import type { SimpleGit } from 'simple-git';
import type { MockProxy } from 'vitest-mock-extended';
import { mock } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import * as git from '../../../util/git/index.ts';
import { getPkgReleases } from '../index.ts';
import { GitRefsDatasource } from './index.ts';

const createSimpleGit = vi.mocked(git.createSimpleGit);

const packageName = 'https://github.com/example/example.git';

const lsRemote1 = Fixtures.get('ls-remote-1.txt');

const datasource = GitRefsDatasource.id;

describe('modules/datasource/git-refs/index', () => {
  let gitMock: MockProxy<SimpleGit>;

  beforeEach(() => {
    // clear environment variables
    process.env = {};

    // reset git mock
    gitMock = mock<SimpleGit>({
      env: vi.fn(),
      listRemote: vi.fn(),
    });

    createSimpleGit.mockReturnValue(gitMock);
  });

  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      gitMock.listRemote.mockResolvedValue('');

      const versions = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(versions).toBeNull();
    });

    it('returns nil if response is malformed', async () => {
      gitMock.listRemote.mockResolvedValue('aabbccddeeff');

      const { releases } = (await getPkgReleases({
        datasource,
        packageName,
      }))!;
      expect(releases).toBeEmpty();
    });

    it('returns nil if remote call throws exception', async () => {
      gitMock.listRemote.mockRejectedValue(new Error());

      const versions = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(versions).toBeNull();
    });

    it('returns versions filtered from tags', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const versions = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(versions).toMatchSnapshot();
      const result = versions?.releases.map((x) => x.version).sort();
      expect(result).toHaveLength(6);
    });
  });

  describe('getDigest()', () => {
    it('returns null if not found', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'v2.0.0',
      );
      expect(digest).toBeNull();
    });

    it('returns digest for tag', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'v1.0.4',
      );
      // For annotated tags, we return the dereferenced commit hash (^{})
      // to match what `git submodule status` returns
      expect(digest).toBe('3ed9e7d7094fd4ee7751c24a3e6b706060f461ff');
    });

    it('ignores refs/for/', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'master',
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
    });

    it('returns digest for HEAD', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
    });

    it('requests authentication for git-refs lookups', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
      expect(createSimpleGit).toHaveBeenCalledExactlyOnceWith({
        authentication: { hostTypes: ['git-refs'] },
      });
    });
  });
});

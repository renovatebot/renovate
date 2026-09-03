import type { SimpleGit } from 'simple-git';
import type { MockProxy } from 'vitest-mock-extended';
import { mock } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import { clearEnv } from '~test/util.ts';
import * as git from '../../../util/git/index.ts';
import { getPkgReleases } from '../index.ts';
import { GitTagsDatasource } from './index.ts';

const createSimpleGit = vi.mocked(git.createSimpleGit);

const packageName = 'https://github.com/example/example.git';

const lsRemote1 = Fixtures.get('ls-remote-1.txt', '../git-refs');

const datasource = GitTagsDatasource.id;
const datasourceInstance = new GitTagsDatasource();

describe('modules/datasource/git-tags/index', () => {
  let gitMock: MockProxy<SimpleGit>;

  beforeEach(() => {
    clearEnv();

    // reset git mock
    gitMock = mock<SimpleGit>({
      listRemote: vi.fn(),
    });

    createSimpleGit.mockReturnValue(gitMock);
  });

  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      gitMock.listRemote.mockResolvedValue('');

      const versions = await getPkgReleases({ datasource, packageName });
      expect(versions).toBeNull();
    });

    it('returns nil if remote call throws exception', async () => {
      gitMock.listRemote.mockRejectedValue(new Error());

      const versions = await getPkgReleases({ datasource, packageName });
      expect(versions).toBeNull();
    });

    it('returns versions filtered from tags', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const versions = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(versions).toMatchSnapshot();
    });
  });

  describe('getDigest()', () => {
    it('returns null if not found', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await datasourceInstance.getDigest(
        { packageName: 'a tag to look up' },
        'notfound',
      );
      expect(digest).toBeNull();
    });

    it('returns digest for tag', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await datasourceInstance.getDigest(
        { packageName: 'a tag to look up' },
        'v1.0.2',
      );
      expect(digest).toBe('3936a6bced3587dc9fd464b0a910e0dfd4cfe10d');
    });

    it('returns digest for HEAD', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await datasourceInstance.getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
    });

    it('requests authentication for git-tags lookups', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await datasourceInstance.getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
      expect(createSimpleGit).toHaveBeenCalledExactlyOnceWith({
        authentication: { hostTypes: ['git-tags'] },
      });
    });
  });
});

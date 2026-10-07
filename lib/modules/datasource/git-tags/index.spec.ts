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

// a lightweight tag shadowed by a branch of the same name
const lsRemoteShadowedTag = [
  'a1d9b3fa58c5d9b7bd0b1bd8b0aa4b44b0b4a1d9\trefs/heads/v3.0.0',
  'b2e0c4fb69d6e0c8ce1c2ce9c1bb5c55c1c5b2e0\trefs/tags/v3.0.0',
].join('\n');

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
      expect(versions).toEqual({
        releases: [
          {
            gitRef: 'v1.0.0',
            newDigest: '7b756026fb2de270240a889a413e7e3a9d4d4d85',
            version: 'v1.0.0',
          },
          {
            gitRef: 'v1.0.1',
            newDigest: 'e173183f932ba8a31d0e4f23cc1070e8ebfa59d6',
            version: 'v1.0.1',
          },
          {
            gitRef: 'v1.0.2',
            newDigest: '3936a6bced3587dc9fd464b0a910e0dfd4cfe10d',
            version: 'v1.0.2',
          },
          {
            gitRef: 'v1.0.3',
            newDigest: '125ca9f3df4151e50046e5327ecb29ec4c13efab',
            version: 'v1.0.3',
          },
          {
            gitRef: 'v1.0.4',
            newDigest: '3ed9e7d7094fd4ee7751c24a3e6b706060f461ff',
            version: 'v1.0.4',
          },
          {
            gitRef: 'v1.0.5',
            newDigest: '6d7a933c2e6b7b39e992b1f93b6b42de083b28f0',
            version: 'v1.0.5',
          },
        ],
        sourceUrl: 'https://github.com/example/example',
      });
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

    it('returns null if there are no refs', async () => {
      gitMock.listRemote.mockResolvedValue('');

      const digest = await datasourceInstance.getDigest(
        { packageName: 'a tag to look up' },
        'v1.0.2',
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

    it('ignores a branch with the same name as the tag', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemoteShadowedTag);

      const digest = await datasourceInstance.getDigest(
        { packageName: 'a tag to look up' },
        'v3.0.0',
      );
      expect(digest).toBe('b2e0c4fb69d6e0c8ce1c2ce9c1bb5c55c1c5b2e0');
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

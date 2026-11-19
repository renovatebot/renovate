import { git, partial } from '~test/util.ts';
import { PLATFORM_NOT_FOUND } from '../../constants/error-messages.ts';
import type { PlatformId } from '../../constants/index.ts';
import type { CommitFilesConfig } from '../../util/git/types.ts';
import { GerritScm } from './gerrit/scm.ts';
import { GithubScm } from './github/scm.ts';
import { scm, setPlatformScmApi } from './scm.ts';

vi.unmock('./scm.ts'); //mocked from test/setup

describe('modules/platform/scm', () => {
  it('no platform chosen', () => {
    expect(() => scm.branchExists('branchName')).toThrow(PLATFORM_NOT_FOUND);
  });

  it('unknown platform', () => {
    expect(() => setPlatformScmApi('unknown' as PlatformId)).toThrow(
      PLATFORM_NOT_FOUND,
    );
  });

  it.each([
    'azure',
    'github',
    'codecommit',
    'bitbucket',
    'bitbucket-server',
    'forgejo',
    'gitea',
    'github',
    'gitlab',
  ] as PlatformId[])(
    'use util/git module as default implementation for platform %s',
    async (platform: PlatformId) => {
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      setPlatformScmApi(platform);
      await scm.isBranchBehindBase('abc', 'main');
      expect(git.isBranchBehindBase).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['gerrit', GerritScm],
    ['github', GithubScm],
  ] as const)(
    'commitAndPush uses prepareCommit of the %s implementation',
    async (platform, impl) => {
      const prepareCommit = vi
        .spyOn(impl.prototype, 'prepareCommit')
        .mockResolvedValueOnce(null);
      setPlatformScmApi(platform);

      await expect(
        scm.commitAndPush(partial<CommitFilesConfig>({ branchName: 'b' })),
      ).resolves.toBeNull();

      expect(prepareCommit).toHaveBeenCalledOnce();
    },
  );
});

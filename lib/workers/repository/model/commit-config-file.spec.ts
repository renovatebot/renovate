import { fakeSha, scm } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import type { FileChange } from '../../../util/git/types.ts';
import {
  commitConfigFile,
  createConfigFileCommitMessage,
} from './commit-config-file.ts';

const files: FileChange[] = [
  { type: 'addition', path: 'renovate.json', contents: '{}' },
];

describe('workers/repository/model/commit-config-file', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  describe('createConfigFileCommitMessage()', () => {
    it('creates a semantic commit message', () => {
      const res = createConfigFileCommitMessage(
        {
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: 'deps',
        },
        'add renovate.json',
      );

      expect(res).toBe('chore(deps): add renovate.json');
    });

    it('creates a prefixed commit message', () => {
      const res = createConfigFileCommitMessage(
        { commitMessagePrefix: 'RENOV-123' },
        'add renovate.json',
      );

      expect(res).toBe('RENOV-123: add renovate.json');
    });
  });

  describe('commitConfigFile()', () => {
    it('commits the files', async () => {
      const sha = fakeSha('onboarding');
      scm.commitAndPush.mockResolvedValueOnce(sha);

      const res = await commitConfigFile({
        config: { baseBranch: 'dev', platformCommit: 'auto' },
        branchName: 'renovate/configure',
        getFiles: () => files,
        message: 'Add renovate.json',
        prTitle: 'Configure Renovate',
        force: true,
        dryRunMessage: 'DRY-RUN: Would commit files to onboarding branch',
      });

      expect(res).toBe(sha);
      expect(scm.commitAndPush).toHaveBeenCalledExactlyOnceWith({
        baseBranch: 'dev',
        branchName: 'renovate/configure',
        files,
        message: 'Add renovate.json',
        trailers: undefined,
        platformCommit: 'auto',
        force: true,
        prTitle: 'Configure Renovate',
      });
    });

    it('applies commitBody and commitTrailers', async () => {
      await commitConfigFile({
        config: {
          commitBody: 'Signed off by {{{gitAuthor}}}',
          commitTrailers: ['Signed-off-by: {{{gitAuthor}}}'],
          gitAuthor: 'Bot <bot@botland.com>',
        },
        branchName: 'renovate/migrate-config',
        getFiles: () => Promise.resolve(files),
        message: 'Migrate config renovate.json',
        prTitle: 'Migrate Renovate config',
        dryRunMessage: 'DRY-RUN: Would commit files to config migration branch',
      });

      expect(scm.commitAndPush).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message:
            'Migrate config renovate.json\n\nSigned off by Bot <bot@botland.com>',
          trailers: ['Signed-off-by: Bot <bot@botland.com>'],
          force: undefined,
        }),
      );
    });

    it('does nothing in dryRun mode', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      const getFiles = vi.fn();

      const res = await commitConfigFile({
        config: {},
        branchName: 'renovate/configure',
        getFiles,
        message: 'Add renovate.json',
        prTitle: 'Configure Renovate',
        dryRunMessage: 'DRY-RUN: Would commit files to onboarding branch',
      });

      expect(res).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would commit files to onboarding branch',
      );
      expect(getFiles).not.toHaveBeenCalled();
      expect(scm.commitAndPush).not.toHaveBeenCalled();
    });
  });
});

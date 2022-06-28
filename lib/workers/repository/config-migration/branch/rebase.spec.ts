import type { Indent } from 'detect-indent';
import { Fixtures } from '../../../../../test/fixtures';
import {
  RenovateConfig,
  getConfig,
  git,
  partial,
  platform,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { checkoutBranch, commitFiles } from '../../../../util/git';
import { MigratedDataFactory } from './migrated-data';
import type { MigratedData } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';

jest.mock('../../../../util/git');

const formattedMigratedData = Fixtures.getJson(
  './migrated-data-formatted.json'
);

describe('workers/repository/config-migration/branch/rebase', () => {
  const prettierSpy = jest.spyOn(
    MigratedDataFactory,
    'applyPrettierFormatting'
  );

  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
    });
  });

  describe('rebaseMigrationBranch()', () => {
    const raw = Fixtures.getJson('./renovate.json');
    const indent = '  ';
    const renovateConfig = JSON.stringify(raw, undefined, indent) + '\n';
    const filename = 'renovate.json';

    let config: RenovateConfig;
    let migratedConfigData: MigratedData;

    beforeEach(() => {
      jest.resetAllMocks();
      GlobalConfig.reset();
      migratedConfigData = {
        content: renovateConfig,
        filename,
        indent: partial<Indent>({}),
      };
      config = {
        ...getConfig(),
        repository: 'some/repo',
        baseBranch: 'dev',
        defaultBranch: 'master',
      };
    });

    it('does not rebase modified branch', async () => {
      git.isBranchModified.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('does nothing if branch is up to date', async () => {
      git.getFile
        .mockResolvedValueOnce(renovateConfig)
        .mockResolvedValueOnce(renovateConfig);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('rebases migration branch', async () => {
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
    });

    it('applies prettier formatting when rebasing the migration branch ', async () => {
      const formatted = formattedMigratedData.content;
      prettierSpy.mockResolvedValueOnce(formattedMigratedData.content);
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
      expect(commitFiles).toHaveBeenCalledWith({
        branchName: 'renovate/migrate-config',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: formatted,
          },
        ],
        message: 'Migrate config renovate.json',
        platformCommit: false,
        targetBranch: 'dev',
      });
    });

    it('does not rebases migration branch when in dryRun is on', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('rebases via platform', async () => {
      config.platformCommit = true;
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
      expect(platform.commitFiles).toHaveBeenCalledTimes(1);
    });
  });
});

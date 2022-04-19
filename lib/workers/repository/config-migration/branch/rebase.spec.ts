import {
  RenovateConfig,
  defaultConfig,
  git,
  loadJsonFixture,
  platform,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { MigratedData } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';

jest.mock('../../../../util/git');

describe('workers/repository/config-migration/branch/rebase', () => {
  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
    });
  });

  describe('rebaseMigrationBranch()', () => {
    const raw = loadJsonFixture('./renovate.json');
    const indent = '  ';
    const renovateConfig = JSON.stringify(raw, undefined, indent) + '\n';
    const fileName = 'renovate.json';

    let config: RenovateConfig;
    let migratedConfigData: MigratedData;

    beforeEach(() => {
      jest.resetAllMocks();
      GlobalConfig.set({
        dryRun: false,
      });
      migratedConfigData = new MigratedData(renovateConfig, fileName);
      config = {
        ...defaultConfig,
        repository: 'some/repo',
      };
    });

    it('does not rebase modified branch', async () => {
      git.isBranchModified.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('does nothing if branch is up to date', async () => {
      git.getFile
        .mockResolvedValueOnce(renovateConfig)
        .mockResolvedValueOnce(renovateConfig);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('rebases migration branch', async () => {
      git.isBranchStale.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
    });

    it('does not rebases migration branch when in dryRun is on', async () => {
      GlobalConfig.set({
        dryRun: true,
      });
      git.isBranchStale.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('rebases via platform', async () => {
      platform.commitFiles = jest.fn();
      config.platformCommit = true;
      git.isBranchStale.mockResolvedValueOnce(true);
      await rebaseMigrationBranch(config, migratedConfigData);
      expect(platform.commitFiles).toHaveBeenCalledTimes(1);
    });
  });
});

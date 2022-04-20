import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  getConfig,
  git,
  loadJsonFixture,
  mockedFunction,
  platform,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { Pr } from '../../../../modules/platform';
import { createConfigMigrationBranch } from './create';
import { MigratedDataFactory } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';
import { checkConfigMigrationBranch } from './index';

jest.mock('./migrated-data');
jest.mock('./rebase');
jest.mock('./create');
jest.mock('../../../../util/git');

const migratedData = loadJsonFixture('./migrated-data.json');

describe('workers/repository/config-migration/branch/index', () => {
  describe('checkConfigMigrationBranch', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      GlobalConfig.set({
        dryRun: false,
      });
      jest.resetAllMocks();
      config = getConfig();
      config.branchPrefix = 'some/';
      MigratedDataFactory.getAsync = jest.fn().mockResolvedValue(migratedData);
    });

    it('Exited due to error fetching migrated data', async () => {
      MigratedDataFactory.getAsync = jest.fn().mockResolvedValue(undefined);
      await expect(checkConfigMigrationBranch(config)).resolves.toBeNull();
    });

    it('Updates migration branch', async () => {
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      mockedFunction(rebaseMigrationBranch).mockResolvedValueOnce('committed');
      const res = await checkConfigMigrationBranch(config);
      expect(res).toBe(`${config.branchPrefix}migrate-config`);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('Dry runs update migration branch', async () => {
      GlobalConfig.set({
        dryRun: true,
      });
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      mockedFunction(rebaseMigrationBranch).mockResolvedValueOnce('committed');
      const res = await checkConfigMigrationBranch(config);
      expect(res).toBe(`${config.branchPrefix}migrate-config`);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('Creates migration PR', async () => {
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed'
      );
      const res = await checkConfigMigrationBranch(config);
      expect(res).toBe(`${config.branchPrefix}migrate-config`);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('Dry runs create migration PR', async () => {
      GlobalConfig.set({
        dryRun: true,
      });
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed'
      );
      const res = await checkConfigMigrationBranch(config);
      expect(res).toBe(`${config.branchPrefix}migrate-config`);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
  });
});

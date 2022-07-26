import { mock } from 'jest-mock-extended';
import { Fixtures } from '../../../../../test/fixtures';
import {
  RenovateConfig,
  getConfig,
  git,
  mockedFunction,
  platform,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import { createConfigMigrationBranch } from './create';
import type { MigratedData } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';
import { checkConfigMigrationBranch } from '.';

jest.mock('./migrated-data');
jest.mock('./rebase');
jest.mock('./create');
jest.mock('../../../../util/git');

const migratedData = Fixtures.getJson<MigratedData>('./migrated-data.json');

describe('workers/repository/config-migration/branch/index', () => {
  describe('checkConfigMigrationBranch', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      GlobalConfig.set({
        dryRun: null,
      });
      jest.resetAllMocks();
      config = getConfig();
      config.branchPrefix = 'some/';
    });

    it('Exits when Migration is not needed', async () => {
      await expect(
        checkConfigMigrationBranch(config, null)
      ).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'checkConfigMigrationBranch() Config does not need migration'
      );
    });

    it('Updates migration branch & refresh PR', async () => {
      platform.getBranchPr.mockResolvedValue(mock<Pr>());
      // platform.refreshPr is undefined as it is an optional function
      // declared as: refreshPr?(number: number): Promise<void>;
      platform.refreshPr = jest.fn().mockResolvedValueOnce(null);
      mockedFunction(rebaseMigrationBranch).mockResolvedValueOnce('committed');
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#7154)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith(
        'Config Migration PR already exists'
      );
    });

    it('Dry runs update migration branch', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      mockedFunction(rebaseMigrationBranch).mockResolvedValueOnce('committed');
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#7154)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('Creates migration PR', async () => {
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed'
      );
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#7154)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith('Need to create migration PR');
    });

    it('Dry runs create migration PR', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed'
      );
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#7154)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
  });
});

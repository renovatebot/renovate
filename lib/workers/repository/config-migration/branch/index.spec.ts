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
import type { Pr } from '../../../../modules/platform';
import { createConfigMigrationBranch } from './create';
import { MigratedDataFactory } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';
import { checkConfigMigrationBranch } from '.';

jest.mock('./migrated-data');
jest.mock('./rebase');
jest.mock('./create');
jest.mock('../../../../util/git');

const migratedData = JSON.parse(Fixtures.get('./migrated-data.json'));

describe('workers/repository/config-migration/branch/index', () => {
  describe('checkConfigMigrationBranch', () => {
    let config: RenovateConfig;
    const getAsyncSpy = jest.spyOn(MigratedDataFactory, 'getAsync');

    beforeEach(() => {
      GlobalConfig.set({
        dryRun: null,
      });
      jest.resetAllMocks();
      config = getConfig();
      config.branchPrefix = 'some/';
      getAsyncSpy.mockResolvedValue(migratedData);
    });

    it('Exited due to error fetching migrated data', async () => {
      getAsyncSpy.mockResolvedValue(undefined);
      await expect(checkConfigMigrationBranch(config)).resolves.toBeNull();
    });

    it('Updates migration branch & refresh PR', async () => {
      platform.getBranchPr.mockResolvedValue(mock<Pr>());
      // platform.refreshPr is undefined as it is an optional function
      // declared as: refreshPr?(number: number): Promise<void>;
      platform.refreshPr = jest.fn().mockResolvedValueOnce(null);
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

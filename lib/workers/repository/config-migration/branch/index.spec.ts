import { mock } from 'jest-mock-extended';
import { Fixtures } from '../../../../../test/fixtures';
import {
  RenovateConfig,
  git,
  mockedFunction,
  partial,
  platform,
  scm,
} from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
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
jest.mock('../../update/branch/handle-existing');

const migratedData = Fixtures.getJson<MigratedData>('./migrated-data.json');

describe('workers/repository/config-migration/branch/index', () => {
  describe('checkConfigMigrationBranch', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      GlobalConfig.set({
        dryRun: null,
      });
      config = getConfig();
      config.branchPrefix = 'some/';
    });

    it('Exits when Migration is not needed', async () => {
      await expect(
        checkConfigMigrationBranch(config, null),
      ).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'checkConfigMigrationBranch() Config does not need migration',
      );
    });

    it('Updates migration branch & refresh PR', async () => {
      platform.getBranchPr.mockResolvedValue(mock<Pr>());
      // platform.refreshPr is undefined as it is an optional function
      // declared as: refreshPr?(number: number): Promise<void>;
      platform.refreshPr = jest.fn().mockResolvedValueOnce(null);
      mockedFunction(rebaseMigrationBranch).mockResolvedValueOnce('committed');
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#22198)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith(
        'Config Migration PR already exists',
      );
    });

    it('Dry runs update migration branch', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      mockedFunction(rebaseMigrationBranch).mockResolvedValueOnce('committed');
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#22198)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('Creates migration PR', async () => {
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed',
      );
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#22198)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith('Need to create migration PR');
    });

    it('Dry runs create migration PR', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed',
      );
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#22198)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    describe('handle closed PR', () => {
      const title = 'PR title';
      const pr = partial<Pr>({ title, state: 'closed', number: 1 });

      it('skips branch when there is a closed one delete it and add an ignore PR message', async () => {
        platform.findPr.mockResolvedValueOnce(pr);
        platform.getBranchPr.mockResolvedValue(null);
        scm.branchExists.mockResolvedValueOnce(true);
        const res = await checkConfigMigrationBranch(config, migratedData);
        expect(res).toBeNull();
        expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
        expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
        expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
        expect(logger.debug).toHaveBeenCalledWith(
          { prTitle: title },
          'Closed PR already exists. Skipping branch.',
        );
        expect(platform.ensureComment).toHaveBeenCalledTimes(1);
        expect(platform.ensureComment).toHaveBeenCalledWith({
          content:
            '\n\nIf you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.',
          topic: 'Renovate Ignore Notification',
          number: 1,
        });
      });

      it('dryrun: skips branch when there is a closed one and add an ignore PR message', async () => {
        GlobalConfig.set({ dryRun: 'full' });
        platform.findPr.mockResolvedValueOnce(pr);
        platform.getBranchPr.mockResolvedValue(null);
        scm.branchExists.mockResolvedValueOnce(true);
        const res = await checkConfigMigrationBranch(config, migratedData);
        expect(res).toBeNull();
        expect(logger.info).toHaveBeenCalledWith(
          `DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`,
        );
        expect(logger.info).toHaveBeenCalledWith(
          'DRY-RUN: Would delete branch ' + pr.sourceBranch,
        );
        expect(logger.debug).toHaveBeenCalledWith(
          { prTitle: title },
          'Closed PR already exists. Skipping branch.',
        );
        expect(platform.ensureComment).toHaveBeenCalledTimes(0);
      });
    });
  });
});

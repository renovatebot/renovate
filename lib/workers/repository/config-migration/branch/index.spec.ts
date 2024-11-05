import { mock } from 'jest-mock-extended';
import { Fixtures } from '../../../../../test/fixtures';
import type { RenovateConfig } from '../../../../../test/util';
import {
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

    it('does nothing when migration disabled and checkbox unchecked', async () => {
      await expect(
        checkConfigMigrationBranch(
          {
            ...config,
            configMigration: false,
            dependencyDashboardChecks: {
              configMigrationCheckboxState: 'unchecked',
            },
          },
          migratedData,
        ),
      ).resolves.toMatchObject({ result: 'no-migration-branch' });
      expect(logger.debug).toHaveBeenCalledWith(
        'Config migration needed but config migration is disabled and checkbox not checked or not present.',
      );
    });

    it('creates migration branch when migration disabled but checkbox checked', async () => {
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed',
      );
      await expect(
        checkConfigMigrationBranch(
          {
            ...config,
            configMigration: false,
            dependencyDashboardChecks: {
              configMigrationCheckboxState: 'checked',
            },
          },
          migratedData,
        ),
      ).resolves.toMatchObject({
        result: 'migration-branch-exists',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
      });
      expect(logger.debug).toHaveBeenCalledWith('Need to create migration PR');
    });

    it('does not create a branch if migration branch is modified', async () => {
      platform.getBranchPr.mockResolvedValue(
        mock<Pr>({
          number: 1,
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      const res = await checkConfigMigrationBranch(
        {
          ...config,
          configMigration: false,
          dependencyDashboardChecks: {
            configMigrationCheckboxState: 'migration-pr-exists',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'migration-branch-modified',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
      });
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(platform.refreshPr).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith(
        'Config Migration branch has been modified. Skipping branch rebase.',
      );
    });

    it('updates migration branch & refreshes pr when migration disabled but open pr exists', async () => {
      platform.getBranchPr.mockResolvedValue(
        mock<Pr>({
          number: 1,
        }),
      );
      platform.refreshPr = jest.fn().mockResolvedValueOnce(null);
      mockedFunction(rebaseMigrationBranch).mockResolvedValueOnce('committed');
      const res = await checkConfigMigrationBranch(
        {
          ...config,
          configMigration: false,
          dependencyDashboardChecks: {
            configMigrationCheckboxState: 'migration-pr-exists',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'migration-branch-exists',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
      });
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(platform.refreshPr).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'Config Migration PR already exists',
      );
    });

    it('creates migration branch when migration enabled but no pr exists', async () => {
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed',
      );
      const res = await checkConfigMigrationBranch(
        {
          ...config,
          configMigration: true,
          dependencyDashboardChecks: {
            configMigrationCheckboxState: 'no-checkbox',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'migration-branch-exists',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
      });
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith('Need to create migration PR');
    });

    it('updates migration branch & refresh PR when migration enabled and open pr exists', async () => {
      platform.getBranchPr.mockResolvedValue(mock<Pr>());
      platform.refreshPr = jest.fn().mockResolvedValueOnce(null);
      mockedFunction(rebaseMigrationBranch).mockResolvedValueOnce('committed');
      const res = await checkConfigMigrationBranch(
        {
          ...config,
          configMigration: true,
          dependencyDashboardChecks: {
            configMigrationCheckboxState: 'migration-pr-exists',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'migration-branch-exists',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
      });
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
      const res = await checkConfigMigrationBranch(
        {
          ...config,
          configMigration: true,
          dependencyDashboardChecks: {
            configMigrationCheckboxState: 'migration-pr-exists',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'migration-branch-exists',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
      });
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('Dry runs create migration PR', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed',
      );
      const res = await checkConfigMigrationBranch(
        {
          ...config,
          dependencyDashboardChecks: {
            configMigrationCheckboxState: 'checked',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'migration-branch-exists',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
      });
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    describe('handle closed PR', () => {
      const title = 'PR title';
      const pr = partial<Pr>({ title, state: 'closed', number: 1 });

      it('does not create a branch when migration is disabled but needed and a closed pr exists', async () => {
        platform.findPr.mockResolvedValueOnce(pr);
        platform.getBranchPr.mockResolvedValue(null);
        scm.branchExists.mockResolvedValueOnce(true);
        const res = await checkConfigMigrationBranch(
          {
            ...config,
            configMigration: false,
            dependencyDashboardChecks: {
              configMigrationCheckboxState: 'no-checkbox',
            },
          },
          migratedData,
        );
        expect(res).toMatchObject({
          result: 'no-migration-branch',
        });
      });

      it('deletes old branch and creates new migration branch when migration is disabled but needed, a closed pr exists and checkbox is checked', async () => {
        platform.findPr.mockResolvedValueOnce(pr);
        platform.getBranchPr.mockResolvedValue(null);
        scm.branchExists.mockResolvedValueOnce(true);
        mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
          'committed',
        );
        const res = await checkConfigMigrationBranch(
          {
            ...config,
            configMigration: false,
            dependencyDashboardChecks: {
              configMigrationCheckboxState: 'checked',
            },
          },
          migratedData,
        );
        expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
        expect(res).toMatchObject({
          result: 'migration-branch-exists',
          migrationBranch: `${config.branchPrefix!}migrate-config`,
        });
        expect(scm.checkoutBranch).toHaveBeenCalledTimes(1);
      });

      it('does not create a branch when migration is enabled and a closed pr exists', async () => {
        platform.findPr.mockResolvedValueOnce(pr);
        platform.getBranchPr.mockResolvedValue(null);
        scm.branchExists.mockResolvedValueOnce(true);
        const res = await checkConfigMigrationBranch(
          {
            ...config,
            configMigration: true,
            dependencyDashboardChecks: {
              configMigrationCheckboxState: 'no-checkbox',
            },
          },
          migratedData,
        );
        expect(res).toMatchObject({
          result: 'no-migration-branch',
        });
      });

      it('dry run:deletes old branch and creates new migration branch when migration is disabled but needed, a closed pr exists and checkbox is checked', async () => {
        GlobalConfig.set({
          dryRun: 'full',
        });
        platform.findPr.mockResolvedValueOnce(pr);
        platform.getBranchPr.mockResolvedValue(null);
        scm.branchExists.mockResolvedValueOnce(true);
        mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
          'committed',
        );
        const res = await checkConfigMigrationBranch(
          {
            ...config,
            configMigration: false,
            dependencyDashboardChecks: {
              configMigrationCheckboxState: 'checked',
            },
          },
          migratedData,
        );
        expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
        expect(res).toMatchObject({
          result: 'migration-branch-exists',
          migrationBranch: `${config.branchPrefix!}migrate-config`,
        });
        expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
      });
    });
  });
});

import { mock } from 'jest-mock-extended';
import { Fixtures } from '../../../../../test/fixtures';
import type { RenovateConfig } from '../../../../../test/util';
import {
  git,
  mockedFunction,
  // partial,
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

    // exists when migration not needed
    it('exits when migration is not needed', async () => {
      await expect(
        checkConfigMigrationBranch(config, null),
      ).resolves.toBeEmptyObject();
      expect(logger.debug).toHaveBeenCalledWith(
        'checkConfigMigrationBranch() Config does not need migration',
      );
    });

    // returns result:add-checkbox when migration is disabled but needed or checkbox is not ticked
    it('returns add checkbox message when migration disabled and checkbox unchecked', async () => {
      await expect(
        checkConfigMigrationBranch(
          {
            ...config,
            configMigration: false,
            dependencyDashboardChecks: { configMigrationInfo: 'unchecked' },
          },
          migratedData,
        ),
      ).resolves.toMatchObject({ result: 'add-checkbox' });
      expect(logger.debug).toHaveBeenCalledWith(
        'Config migration needed but config migration is disabled and checkbox not ticked.',
      );
    });

    // return result: pr-exists, when migration branch name & pr number when migration disabled & checkbox ticked or open pr exists
    it('creates migration branch when migration disabled but checkbox checked', async () => {
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed',
      );
      await expect(
        checkConfigMigrationBranch(
          {
            ...config,
            configMigration: false,
            dependencyDashboardChecks: { configMigrationInfo: 'checked' },
          },
          migratedData,
        ),
      ).resolves.toMatchObject({
        result: 'pr-exists',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
      });
      expect(logger.debug).toHaveBeenCalledWith('Need to create migration PR');
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
            configMigrationInfo: 'migration-pr-exists',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'pr-exists',
        migrationBranch: `${config.branchPrefix!}migrate-config`,
        prNumber: 1,
      });
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(platform.refreshPr).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'Config Migration PR already exists',
      );
    });

    // return result: pr-exists, migrationBranchName & prNum when migration enabled and no pr or open pr exists
    it('creates migration branch when migration enabled but no pr exists', async () => {
      mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
        'committed',
      );
      const res = await checkConfigMigrationBranch(
        {
          ...config,
          configMigration: true,
          dependencyDashboardChecks: {
            configMigrationInfo: 'unchecked',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'pr-exists',
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
            configMigrationInfo: 'unchecked',
          },
        },
        migratedData,
      );
      // TODO: types (#22198)
      expect(res).toMatchObject({
        result: 'pr-exists',
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
      const res = await checkConfigMigrationBranch(config, migratedData);
      // TODO: types (#22198)
      expect(res).toBe(`${config.branchPrefix!}migrate-config`);
      expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    // it('Creates migration PR', async () => {
    //   mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
    //     'committed',
    //   );
    //   const res = await checkConfigMigrationBranch(config, migratedData);
    //   // TODO: types (#22198)
    //   expect(res).toBe(`${config.branchPrefix!}migrate-config`);
    //   expect(scm.checkoutBranch).toHaveBeenCalledTimes(1);
    //   expect(git.commitFiles).toHaveBeenCalledTimes(0);
    //   expect(logger.debug).toHaveBeenCalledWith('Need to create migration PR');
    // });

    // it('Dry runs create migration PR', async () => {
    //   GlobalConfig.set({
    //     dryRun: 'full',
    //   });
    //   mockedFunction(createConfigMigrationBranch).mockResolvedValueOnce(
    //     'committed',
    //   );
    //   const res = await checkConfigMigrationBranch(config, migratedData);
    //   // TODO: types (#22198)
    //   expect(res).toBe(`${config.branchPrefix!}migrate-config`);
    //   expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
    //   expect(git.commitFiles).toHaveBeenCalledTimes(0);
    // });

    // describe('handle closed PR', () => {
    //   const title = 'PR title';
    //   const pr = partial<Pr>({ title, state: 'closed', number: 1 });

    // returns result:add-checkbox when migration disabled and closed migration pr exists and checkbox not ticked
    // return result: add-checkbox, when migration enabled but closed pr exists

    //   it('skips branch when there is a closed one delete it and add an ignore PR message', async () => {
    //     platform.findPr.mockResolvedValueOnce(pr);
    //     platform.getBranchPr.mockResolvedValue(null);
    //     scm.branchExists.mockResolvedValueOnce(true);
    //     const res = await checkConfigMigrationBranch(config, migratedData);
    //     expect(res).toBeNull();
    //     expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
    //     expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
    //     expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
    //     expect(logger.debug).toHaveBeenCalledWith(
    //       { prTitle: title },
    //       'Closed PR already exists. Skipping branch.',
    //     );
    //     expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    //     expect(platform.ensureComment).toHaveBeenCalledWith({
    //       content:
    //         '\n\nIf you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.',
    //       topic: 'Renovate Ignore Notification',
    //       number: 1,
    //     });
    //   });

    //   it('dryrun: skips branch when there is a closed one and add an ignore PR message', async () => {
    //     GlobalConfig.set({ dryRun: 'full' });
    //     platform.findPr.mockResolvedValueOnce(pr);
    //     platform.getBranchPr.mockResolvedValue(null);
    //     scm.branchExists.mockResolvedValueOnce(true);
    //     const res = await checkConfigMigrationBranch(config, migratedData);
    //     expect(res).toBeNull();
    //     expect(logger.info).toHaveBeenCalledWith(
    //       `DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`,
    //     );
    //     expect(logger.info).toHaveBeenCalledWith(
    //       'DRY-RUN: Would delete branch ' + pr.sourceBranch,
    //     );
    //     expect(logger.debug).toHaveBeenCalledWith(
    //       { prTitle: title },
    //       'Closed PR already exists. Skipping branch.',
    //     );
    //     expect(platform.ensureComment).toHaveBeenCalledTimes(0);
    //   });
    // });
  });
});

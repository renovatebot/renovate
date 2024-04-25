import type { Indent } from 'detect-indent';
import { Fixtures } from '../../../../../test/fixtures';
import { RenovateConfig, partial } from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { scm } from '../../../../modules/platform/scm';
import { createConfigMigrationBranch } from './create';
import { MigratedDataFactory } from './migrated-data';
import type { MigratedData } from './migrated-data';

jest.mock('../../../../util/git');

describe('workers/repository/config-migration/branch/create', () => {
  const raw = Fixtures.getJson('./renovate.json');
  const indent = '  ';
  const renovateConfig = JSON.stringify(raw, undefined, indent) + '\n';
  const filename = 'renovate.json';
  const prettierSpy = jest.spyOn(
    MigratedDataFactory,
    'applyPrettierFormatting',
  );

  let config: RenovateConfig;
  let migratedConfigData: MigratedData;

  beforeEach(() => {
    config = getConfig();
    config.baseBranch = 'dev';
    config.defaultBranch = 'master';
    migratedConfigData = {
      content: renovateConfig,
      filename,
      indent: partial<Indent>(),
    };
    prettierSpy.mockResolvedValueOnce(migratedConfigData.content);
  });

  describe('createConfigMigrationBranch', () => {
    it('applies the default commit message', async () => {
      await createConfigMigrationBranch(config, migratedConfigData);
      expect(scm.checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
      expect(scm.commitAndPush).toHaveBeenCalledWith({
        branchName: 'renovate/migrate-config',
        baseBranch: 'dev',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: renovateConfig,
          },
        ],
        message: 'Migrate config renovate.json',
        platformCommit: false,
      });
    });

    it('applies supplied commit message', async () => {
      const message = 'We can migrate config if we want to, or we can not';

      config.commitMessage = message;

      await createConfigMigrationBranch(config, migratedConfigData);

      expect(scm.checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
      expect(scm.commitAndPush).toHaveBeenCalledWith({
        branchName: 'renovate/migrate-config',
        baseBranch: 'dev',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: renovateConfig,
          },
        ],
        message,
        platformCommit: false,
      });
    });

    describe('applies the commitMessagePrefix value', () => {
      it('to the default commit message', async () => {
        config.commitMessagePrefix = 'PREFIX:';
        config.commitMessage = '';

        const message = `PREFIX: migrate config renovate.json`;
        await createConfigMigrationBranch(config, migratedConfigData);

        expect(scm.checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          baseBranch: 'dev',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: renovateConfig,
            },
          ],
          message,
          platformCommit: false,
        });
      });
    });

    describe('applies the commitMessageSuffix value', () => {
      it('to the default commit message', async () => {
        const suffix = 'SUFFIX';
        config.commitMessageSuffix = suffix;

        const message = `Migrate config renovate.json ${suffix}`;
        await createConfigMigrationBranch(config, migratedConfigData);

        expect(scm.checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          baseBranch: 'dev',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: renovateConfig,
            },
          ],
          message,
          platformCommit: false,
        });
      });
    });

    describe('applies semanticCommit prefix', () => {
      it('to the default commit message', async () => {
        const prefix = 'chore(config)';
        const message = `${prefix}: migrate config renovate.json`;

        config.semanticCommits = 'enabled';

        await createConfigMigrationBranch(config, migratedConfigData);

        expect(scm.checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          baseBranch: 'dev',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: renovateConfig,
            },
          ],
          message,
          platformCommit: false,
        });
      });

      it('uses user defined semantic commit type', async () => {
        const prefix = 'type(config)';
        const message = `${prefix}: migrate config renovate.json`;

        config.semanticCommits = 'enabled';
        config.semanticCommitType = 'type';

        await createConfigMigrationBranch(config, migratedConfigData);

        expect(scm.checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          baseBranch: 'dev',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: renovateConfig,
            },
          ],
          message,
          platformCommit: false,
        });
      });
    });
  });
});

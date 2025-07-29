import { codeBlock } from 'common-tags';
import type { Indent } from 'detect-indent';
import { getConfig } from '../../../../config/defaults';
import { createConfigMigrationBranch } from './create';
import { MigratedDataFactory } from './migrated-data';
import type { MigratedData } from './migrated-data';
import { Fixtures } from '~test/fixtures';
import { fs, partial, scm } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('../../../../util/fs');

describe('workers/repository/config-migration/branch/create', () => {
  const raw = Fixtures.getJson('./renovate.json');
  const indent = '  ';
  const renovateConfig = JSON.stringify(raw, undefined, indent) + '\n';
  const filename = 'renovate.json';
  const prettierSpy = vi.spyOn(MigratedDataFactory, 'applyPrettierFormatting');

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
        platformCommit: 'auto',
        force: true,
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
        platformCommit: 'auto',
        force: true,
      });
    });

    it('migrates renovate config in package.json', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        {
          "dependencies": {
            "xmldoc": "1.0.0"
          },
          "renovate": ${renovateConfig}
        }
      `);
      scm.getFileList.mockResolvedValueOnce([]);
      await createConfigMigrationBranch(config, {
        ...migratedConfigData,
        filename: 'package.json',
      });
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
          {
            type: 'addition',
            path: 'package.json',
            contents: '{"dependencies":{"xmldoc":"1.0.0"}}',
          },
        ],
        message: 'Migrate config renovate.json',
        platformCommit: 'auto',
        force: true,
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
          platformCommit: 'auto',
          force: true,
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
          platformCommit: 'auto',
          force: true,
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
          platformCommit: 'auto',
          force: true,
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
          platformCommit: 'auto',
          force: true,
        });
      });
    });
  });
});

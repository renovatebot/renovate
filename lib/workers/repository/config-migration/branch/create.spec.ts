import { Fixtures } from '../../../../../test/fixtures';
import { RenovateConfig, getConfig, platform } from '../../../../../test/util';
import { commitFiles } from '../../../../util/git';
import { createConfigMigrationBranch } from './create';
import type { MigratedData } from './migrated-data';

jest.mock('../../../../util/git');

describe('workers/repository/config-migration/branch/create', () => {
  const raw = Fixtures.getJson('./renovate.json');
  const indent = '  ';
  const renovateConfig = JSON.stringify(raw, undefined, indent) + '\n';
  const filename = 'renovate.json';

  let config: RenovateConfig;
  let migratedConfigData: MigratedData;

  beforeEach(() => {
    jest.clearAllMocks();
    config = getConfig();
    migratedConfigData = { content: renovateConfig, filename };
  });

  describe('createConfigMigrationBranch', () => {
    it('applies the default commit message', async () => {
      await createConfigMigrationBranch(config, migratedConfigData);
      expect(commitFiles).toHaveBeenCalledWith({
        branchName: 'renovate/migrate-config',
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

    it('commits via platform', async () => {
      config.platformCommit = true;

      await createConfigMigrationBranch(config, migratedConfigData);

      expect(platform.commitFiles).toHaveBeenCalledWith({
        branchName: 'renovate/migrate-config',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: renovateConfig,
          },
        ],
        message: 'Migrate config renovate.json',
        platformCommit: true,
      });
    });

    it('applies supplied commit message', async () => {
      const message = 'We can migrate config if we want to, or we can not';

      config.commitMessage = message;

      await createConfigMigrationBranch(config, migratedConfigData);

      expect(commitFiles).toHaveBeenCalledWith({
        branchName: 'renovate/migrate-config',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: renovateConfig,
          },
        ],
        message: message,
        platformCommit: false,
      });
    });

    describe('applies the commitMessagePrefix value', () => {
      it('to the default commit message', async () => {
        config.commitMessagePrefix = 'PREFIX:';
        config.commitMessage = '';

        const message = `PREFIX: migrate config renovate.json`;
        await createConfigMigrationBranch(config, migratedConfigData);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: renovateConfig,
            },
          ],
          message: message,
          platformCommit: false,
        });
      });

      it('to the supplied commit message prefix, topic & action', async () => {
        const prefix = 'PREFIX:';
        const topic = 'thats a topic';
        const action = 'action';

        const message = `${prefix} ${action} ${topic}`;

        config.commitMessagePrefix = prefix;
        config.commitMessageTopic = topic;
        config.commitMessageAction = action;

        await createConfigMigrationBranch(config, migratedConfigData);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: renovateConfig,
            },
          ],
          message: message,
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

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: renovateConfig,
            },
          ],
          message: message,
          platformCommit: false,
        });
      });

      it('to the supplied commit message topic', async () => {
        const prefix = 'chore(config)';
        const topic = 'supplied topic';
        const message = `${prefix}: ${topic}`;

        config.semanticCommits = 'enabled';
        config.commitMessageTopic = topic;

        await createConfigMigrationBranch(config, migratedConfigData);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: renovateConfig,
            },
          ],
          message: message,
          platformCommit: false,
        });
      });
    });
  });
});

import { EnabledManagersMigration } from './enabled-managers-migration.ts';

describe('config/migrations/custom/enabled-managers-migration', () => {
  it('migrates', async () => {
    await expect(EnabledManagersMigration).toMigrate(
      {
        enabledManagers: [
          'test1',
          'yarn',
          'test2',
          'regex',
          'custom.regex',
          'renovate-config-presets',
        ],
      },
      {
        enabledManagers: [
          'test1',
          'npm',
          'test2',
          'custom.regex',
          'custom.regex',
          'renovate-config',
        ],
      },
    );

    // coverage
    await expect(EnabledManagersMigration).not.toMigrate(
      {
        enabledManagers: undefined,
      },
      {
        enabledManagers: undefined,
      },
    );
  });
});

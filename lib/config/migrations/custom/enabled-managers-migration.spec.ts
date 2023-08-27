import { EnabledManagersMigration } from './enabled-managers-migration';

describe('config/migrations/custom/enabled-managers-migration', () => {
  it('migrates', () => {
    expect(EnabledManagersMigration).toMigrate(
      {
        enabledManagers: ['test1', 'yarn', 'test2', 'regex'],
      },
      {
        enabledManagers: ['test1', 'npm', 'test2', 'custom.regex'],
      }
    );

    // coverage
    expect(EnabledManagersMigration).not.toMigrate(
      {
        enabledManagers: undefined,
      },
      {
        enabledManagers: undefined,
      }
    );
  });
});

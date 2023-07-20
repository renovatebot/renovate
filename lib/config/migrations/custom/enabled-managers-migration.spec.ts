import { EnabledManagersMigration } from './enabled-managers-migration';

describe('config/migrations/custom/enabled-managers-migration', () => {
  it('should replace yarn with npm', () => {
    expect(EnabledManagersMigration).toMigrate(
      {
        enabledManagers: ['test1', 'yarn', 'test2', 'regex'],
      },
      {
        enabledManagers: ['test1', 'npm', 'test2', 'custom'],
      }
    );
  });
});

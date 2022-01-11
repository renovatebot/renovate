import { EnabledManagersMigration } from './enabled-managers-migration';

describe('config/migrations/custom/enabled-managers-migration', () => {
  it('should replace yarn by nmp', () => {
    expect(EnabledManagersMigration).toMigrate(
      {
        enabledManagers: ['test1', 'yarn', 'test2'],
      },
      {
        enabledManagers: ['test1', 'npm', 'test2'],
      }
    );
  });
});

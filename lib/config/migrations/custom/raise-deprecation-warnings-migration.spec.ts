import { RaiseDeprecationWarningsMigration } from './raise-deprecation-warnings-migration';

describe('config/migrations/custom/raise-deprecation-warnings-migration', () => {
  it('should migrate false', () => {
    expect(RaiseDeprecationWarningsMigration).toMigrate(
      { raiseDeprecationWarnings: false },
      {
        suppressNotifications: ['deprecationWarningIssues'],
      },
    );
  });

  it('should migrate false and concat with existing value', () => {
    expect(RaiseDeprecationWarningsMigration).toMigrate(
      {
        raiseDeprecationWarnings: false,
        suppressNotifications: ['test'],
      },
      { suppressNotifications: ['test', 'deprecationWarningIssues'] },
    );
  });

  it('should just remove property when raiseDeprecationWarnings not equals to true', () => {
    expect(RaiseDeprecationWarningsMigration).toMigrate(
      {
        raiseDeprecationWarnings: true,
      },
      {},
    );
  });
});

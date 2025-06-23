import { RequiredStatusChecksMigration } from './required-status-checks-migration';

describe('config/migrations/custom/required-status-checks-migration', () => {
  it('should migrate requiredStatusChecks=null to ignoreTests=true', () => {
    expect(RequiredStatusChecksMigration).toMigrate(
      {
        requiredStatusChecks: null,
      },
      {
        ignoreTests: true,
      },
    );
  });
});

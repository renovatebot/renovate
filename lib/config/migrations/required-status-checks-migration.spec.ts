import { RequiredStatusChecksMigration } from './required-status-checks-migration';

describe('config/migrations/required-status-checks-migration', () => {
  it('should migrate requiredStatusChecks=null to ignoreTests=true', () => {
    const originalConfig: any = {
      requiredStatusChecks: null,
    };
    const migratedConfig: any = {
      requiredStatusChecks: null,
    };
    const migration = new RequiredStatusChecksMigration(
      originalConfig,
      migratedConfig
    );

    expect(migratedConfig.requiredStatusChecks).toBeNull();
    migration.migrate();
    expect(migratedConfig.requiredStatusChecks).toBeUndefined();
    expect(migratedConfig.ignoreTests).toBeTrue();
  });
});

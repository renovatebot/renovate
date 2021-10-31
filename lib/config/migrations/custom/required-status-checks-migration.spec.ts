import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/required-status-checks-migration', () => {
  it('should migrate requiredStatusChecks=null to ignoreTests=true', () => {
    const migratedConfig = MigrationsService.run({
      requiredStatusChecks: null,
    });

    expect(migratedConfig.requiredStatusChecks).toBeUndefined();
    expect(migratedConfig.ignoreTests).toBeTrue();
  });
});

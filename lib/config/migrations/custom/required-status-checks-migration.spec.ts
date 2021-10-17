import type { RenovateConfig } from '../../types';
import { RequiredStatusChecksMigration } from './required-status-checks-migration';

describe('config/migrations/custom/required-status-checks-migration', () => {
  it('should migrate requiredStatusChecks=null to ignoreTests=true', () => {
    const originalConfig: RenovateConfig = {
      requiredStatusChecks: null,
    };
    const migratedConfig: RenovateConfig = {
      requiredStatusChecks: null,
    };
    const migration = new RequiredStatusChecksMigration(
      originalConfig,
      migratedConfig
    );
    migration.run();

    expect(migratedConfig.requiredStatusChecks).toBeUndefined();
    expect(migratedConfig.ignoreTests).toBeTrue();
  });
});

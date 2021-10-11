import type { RenovateConfig } from '../../types';
import { RequiredStatusChecksMigration } from './required-status-checks-migration';

describe('config/migrations/custom/required-status-checks-migration', () => {
  it('should migrate requiredStatusChecks=null to ignoreTests=true', () => {
    const originalConfig: Partial<RenovateConfig> = {
      requiredStatusChecks: null,
    };
    const migration = new RequiredStatusChecksMigration();
    const migratedConfig = migration.run(originalConfig);

    expect(migratedConfig.requiredStatusChecks).toBeUndefined();
    expect(migratedConfig.ignoreTests).toBeTrue();
  });
});

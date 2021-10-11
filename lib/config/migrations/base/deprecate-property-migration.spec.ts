import type { RenovateConfig } from '../../types';
import { DeprecatePropertyMigration } from './deprecate-property-migration';

describe('config/migrations/base/deprecate-property-migration', () => {
  it('should remove property from configuration', () => {
    const originalConfig: Partial<RenovateConfig> = {
      test: 'test',
    };
    const migration = new DeprecatePropertyMigration('test');
    const migratedConfig = migration.run(originalConfig);

    expect(migratedConfig.test).toBeUndefined();
  });
});

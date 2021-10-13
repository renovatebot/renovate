import type { RenovateConfig } from '../../types';
import { RemovePropertyMigration } from './remove-property-migration';

describe('config/migrations/base/remove-property-migration', () => {
  it('should remove property from configuration', () => {
    const originalConfig: RenovateConfig = {
      test: 'test',
    };
    const migratedConfig: RenovateConfig = {
      test: 'test',
    };
    const migration = new RemovePropertyMigration(
      'test',
      originalConfig,
      migratedConfig
    );
    migration.run();

    expect(migratedConfig.test).toBeUndefined();
  });
});

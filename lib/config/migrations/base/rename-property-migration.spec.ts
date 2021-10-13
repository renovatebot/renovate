import type { RenovateConfig } from '../../types';
import { RenamePropertyMigration } from './rename-property-migration';

describe('config/migrations/base/rename-property-migration', () => {
  it('should rename property', () => {
    const originalConfig: RenovateConfig = {
      old: 'test',
    };
    const migratedConfig: RenovateConfig = {
      old: 'test',
    };
    const migration = new RenamePropertyMigration(
      'old',
      'new',
      originalConfig,
      migratedConfig
    );
    migration.run();

    expect(migratedConfig.old).toBeUndefined();
    expect(migratedConfig.new).toBe('test');
  });
});

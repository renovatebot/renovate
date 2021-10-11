import type { RenovateConfig } from '../../types';
import { ReplacePropertyMigration } from './replace-property-migration';

describe('config/migrations/base/replace-property-migration', () => {
  it('should rename property', () => {
    const originalConfig: Partial<RenovateConfig> = {
      old: 'test',
    };
    const migration = new ReplacePropertyMigration('old', 'new');
    const migratedConfig = migration.run(originalConfig);

    expect(migratedConfig.old).toBeUndefined();
    expect(migratedConfig.new).toBe('test');
  });
});

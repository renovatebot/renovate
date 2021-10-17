import type { RenovateConfig } from '../../types';
import { GoModTidyMigration } from './go-mod-tidy-migration';

describe('config/migrations/custom/go-mod-tidy-migration', () => {
  it('should add postUpdateOptions option when true', () => {
    const originalConfig: RenovateConfig = {
      gomodTidy: true,
      postUpdateOptions: ['test'],
    };
    const migratedConfig: RenovateConfig = {};
    const migration = new GoModTidyMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toContain('test');
    expect(migratedConfig.postUpdateOptions).toContain('gomodTidy');
  });

  it('should handle case when postUpdateOptions is not defined ', () => {
    const originalConfig: RenovateConfig = {
      gomodTidy: true,
    };
    const migratedConfig: RenovateConfig = {};
    const migration = new GoModTidyMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toContain('gomodTidy');
  });

  it('should only remove when false', () => {
    const originalConfig: RenovateConfig = {
      gomodTidy: false,
    };
    const migratedConfig: RenovateConfig = {};
    const migration = new GoModTidyMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toBeUndefined();
  });
});

import type { RenovateConfig } from '../../types';
import { GoModTidyMigration } from './go-mod-tidy-migration';

describe('config/migrations/custom/go-mod-tidy-migration', () => {
  it('should add postUpdateOptions option when true', () => {
    const originalConfig: Partial<RenovateConfig> = {
      gomodTidy: true,
      postUpdateOptions: ['test'],
    };
    const migratedConfig: Partial<RenovateConfig> = {};
    const migration = new GoModTidyMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toContain('test');
    expect(migratedConfig.postUpdateOptions).toContain('gomodTidy');
  });

  it('should handle case when postUpdateOptions is not defined ', () => {
    const originalConfig: Partial<RenovateConfig> = {
      gomodTidy: true,
    };
    const migratedConfig: Partial<RenovateConfig> = {};
    const migration = new GoModTidyMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toContain('gomodTidy');
  });

  it('should only remove when false', () => {
    const originalConfig: Partial<RenovateConfig> = {
      gomodTidy: false,
    };
    const migratedConfig: Partial<RenovateConfig> = {};
    const migration = new GoModTidyMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.gomodTidy).toBeUndefined();
    expect(migratedConfig.postUpdateOptions).toBeUndefined();
  });
});

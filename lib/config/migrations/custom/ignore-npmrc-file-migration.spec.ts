import { MigrationsService } from '../migrations-service';
import { IgnoreNpmrcFileMigration } from './ignore-npmrc-file-migration';

describe('config/migrations/custom/ignore-npmrc-file-migration', () => {
  it('should init npmrc field', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        ignoreNpmrcFile: true,
      },
      IgnoreNpmrcFileMigration
    );

    expect(migratedConfig).not.toHaveProperty('ignoreNpmrcFile');
    expect(migratedConfig.npmrc).toBe('');
  });
});

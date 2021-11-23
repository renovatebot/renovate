import { MigrationsService } from '../migrations-service';
import { BaseBranchMigration } from './base-branch-migration';

describe('config/migrations/custom/base-branch-migration', () => {
  it('should migrate value to array', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        baseBranch: 'test',
      },
      BaseBranchMigration
    );

    expect(migratedConfig).not.toHaveProperty('baseBranch');
    expect(migratedConfig.baseBranches).toEqual(['test']);
  });

  it('should migrate array', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        baseBranch: ['test'],
      } as any,
      BaseBranchMigration
    );

    expect(migratedConfig).not.toHaveProperty('baseBranch');
    expect(migratedConfig.baseBranches).toEqual(['test']);
  });
});

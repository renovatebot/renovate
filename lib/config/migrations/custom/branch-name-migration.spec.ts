import { MigrationsService } from '../migrations-service';
import { BranchNameMigration } from './branch-name-migration';

describe('config/migrations/custom/branch-name-migration', () => {
  it('should replace pattern', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        branchName: 'test {{managerBranchPrefix}} test',
      },
      BranchNameMigration
    );

    expect(migratedConfig.branchName).toBe(
      'test {{additionalBranchPrefix}} test'
    );
  });
});

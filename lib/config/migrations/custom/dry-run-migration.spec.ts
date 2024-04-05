import { DryRunMigration } from './dry-run-migration';

describe('config/migrations/custom/dry-run-migration', () => {
  it('should migrate dryRun=true to dryRun=full', () => {
    expect(DryRunMigration).toMigrate(
      {
        dryRun: true,
      },
      {
        dryRun: 'full',
      },
    );
  });

  it('should migrate dryRun=false to dryRun=null', () => {
    expect(DryRunMigration).toMigrate(
      {
        dryRun: false,
      },
      {
        dryRun: null,
      },
    );
  });
});

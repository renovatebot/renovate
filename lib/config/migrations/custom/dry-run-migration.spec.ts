import { DryRunMigration } from './dry-run-migration.ts';

describe('config/migrations/custom/dry-run-migration', () => {
  it('should migrate dryRun=true to dryRun=full', async () => {
    await expect(DryRunMigration).toMigrate(
      {
        dryRun: true,
      },
      {
        dryRun: 'full',
      },
    );
  });

  it('should migrate dryRun=false to dryRun=null', async () => {
    await expect(DryRunMigration).toMigrate(
      {
        dryRun: false,
      },
      {
        dryRun: null,
      },
    );
  });

  it.each`
    value      | expected
    ${'true'}  | ${'full'}
    ${'false'} | ${null}
    ${'null'}  | ${null}
  `(
    'should migrate dryRun=$value to $expected',
    async ({ value, expected }) => {
      await expect(DryRunMigration).toMigrate(
        { dryRun: value },
        { dryRun: expected },
      );
    },
  );

  it('should not migrate dryRun=full', async () => {
    await expect(DryRunMigration).not.toMigrate(
      { dryRun: 'full' },
      { dryRun: 'full' },
    );
  });
});

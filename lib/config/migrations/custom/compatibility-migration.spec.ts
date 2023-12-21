import { CompatibilityMigration } from './compatibility-migration';

describe('config/migrations/custom/compatibility-migration', () => {
  it('should migrate object', () => {
    expect(CompatibilityMigration).toMigrate(
      {
        compatibility: {
          test: 'test',
        },
      },
      {
        constraints: {
          test: 'test',
        },
      },
    );
  });

  it('should just remove property when compatibility is not an object', () => {
    expect(CompatibilityMigration).toMigrate(
      {
        compatibility: 'test',
      },
      {},
    );
  });
});

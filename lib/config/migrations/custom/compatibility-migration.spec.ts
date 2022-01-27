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
      }
    );
  });
});

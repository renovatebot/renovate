import { GoModTidyMigration } from './go-mod-tidy-migration';

describe('config/migrations/custom/go-mod-tidy-migration', () => {
  it('should add postUpdateOptions option when true', () => {
    expect(GoModTidyMigration).toMigrate(
      {
        gomodTidy: true,
        postUpdateOptions: ['test'],
      },
      {
        postUpdateOptions: ['test', 'gomodTidy'],
      },
    );
  });

  it('should handle case when postUpdateOptions is not defined ', () => {
    expect(GoModTidyMigration).toMigrate(
      {
        gomodTidy: true,
      },
      {
        postUpdateOptions: ['gomodTidy'],
      },
    );
  });

  it('should only remove when false', () => {
    expect(GoModTidyMigration).toMigrate(
      {
        gomodTidy: false,
      },
      {},
    );
  });
});

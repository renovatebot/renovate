import { validateCustomMigration } from '../validator';
import { GoModTidyMigration } from './go-mod-tidy-migration';

describe('config/migrations/custom/go-mod-tidy-migration', () => {
  it('should add postUpdateOptions option when true', () => {
    validateCustomMigration(
      GoModTidyMigration,
      {
        gomodTidy: true,
        postUpdateOptions: ['test'],
      },
      {
        postUpdateOptions: ['test', 'gomodTidy'],
      }
    );
  });

  it('should handle case when postUpdateOptions is not defined ', () => {
    validateCustomMigration(
      GoModTidyMigration,
      {
        gomodTidy: true,
      },
      {
        postUpdateOptions: ['gomodTidy'],
      }
    );
  });

  it('should only remove when false', () => {
    validateCustomMigration(
      GoModTidyMigration,
      {
        gomodTidy: false,
      },
      {}
    );
  });
});

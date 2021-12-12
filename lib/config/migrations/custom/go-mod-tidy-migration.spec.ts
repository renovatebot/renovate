import { getCustomMigrationValidator } from '../validator';
import { GoModTidyMigration } from './go-mod-tidy-migration';

describe('config/migrations/custom/go-mod-tidy-migration', () => {
  const validate = getCustomMigrationValidator(GoModTidyMigration);

  it('should add postUpdateOptions option when true', () => {
    validate(
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
    validate(
      {
        gomodTidy: true,
      },
      {
        postUpdateOptions: ['gomodTidy'],
      }
    );
  });

  it('should only remove when false', () => {
    validate(
      {
        gomodTidy: false,
      },
      {}
    );
  });
});

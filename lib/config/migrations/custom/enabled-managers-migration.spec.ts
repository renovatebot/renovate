import { getCustomMigrationValidator } from '../validator';
import { EnabledManagersMigration } from './enabled-managers-migration';

describe('config/migrations/custom/enabled-managers-migration', () => {
  const validate = getCustomMigrationValidator(EnabledManagersMigration);

  it('should replace yarn by nmp', () => {
    validate(
      {
        enabledManagers: ['test1', 'yarn', 'test2'],
      },
      {
        enabledManagers: ['test1', 'npm', 'test2'],
      }
    );
  });
});

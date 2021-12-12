import { getCustomMigrationValidator } from '../validator';
import { BinarySourceMigration } from './binary-source-migration';

describe('config/migrations/custom/binary-source-migration', () => {
  const validate = getCustomMigrationValidator(BinarySourceMigration);

  it('should migrate "auto" to "global"', () => {
    validate(
      {
        binarySource: 'auto',
      },
      {
        binarySource: 'global',
      }
    );
  });
});

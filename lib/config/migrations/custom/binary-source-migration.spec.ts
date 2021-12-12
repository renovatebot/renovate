import { validateCustomMigration } from '../validator';
import { BinarySourceMigration } from './binary-source-migration';

describe('config/migrations/custom/binary-source-migration', () => {
  it('should migrate "auto" to "global"', () => {
    validateCustomMigration(
      BinarySourceMigration,
      {
        binarySource: 'auto',
      },
      {
        binarySource: 'global',
      }
    );
  });
});

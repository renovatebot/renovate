import { BinarySourceMigration } from './binary-source-migration.ts';

describe('config/migrations/custom/binary-source-migration', () => {
  it('should migrate "auto" to "global"', async () => {
    await expect(BinarySourceMigration).toMigrate(
      {
        binarySource: 'auto',
      },
      {
        binarySource: 'global',
      },
    );
  });
});

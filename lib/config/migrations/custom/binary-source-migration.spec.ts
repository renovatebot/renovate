import { BinarySourceMigration } from './binary-source-migration';

describe('config/migrations/custom/binary-source-migration', () => {
  it('should migrate "auto" to "global"', () => {
    expect(BinarySourceMigration).toMigrate(
      {
        binarySource: 'auto',
      },
      {
        binarySource: 'global',
      },
    );
  });
});

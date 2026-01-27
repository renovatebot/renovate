import { SeparateMajorReleasesMigration } from './separate-major-release-migration.ts';

describe('config/migrations/custom/separate-major-release-migration', () => {
  it('should migrate', async () => {
    await expect(SeparateMajorReleasesMigration).toMigrate(
      {
        separateMajorReleases: true,
      },
      {
        separateMajorMinor: true,
        separateMajorReleases: true,
      },
    );
  });
});

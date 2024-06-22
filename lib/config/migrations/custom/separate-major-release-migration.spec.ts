import { SeparateMajorReleasesMigration } from './separate-major-release-migration';

describe('config/migrations/custom/separate-major-release-migration', () => {
  it('should migrate', () => {
    expect(SeparateMajorReleasesMigration).toMigrate(
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

import { SeparateMultipleMajorMigration } from './separate-multiple-major-migration';

describe('config/migrations/custom/separate-multiple-major-migration', () => {
  it('should remove if separateMajorReleases exists', () => {
    expect(SeparateMultipleMajorMigration).toMigrate(
      {
        separateMajorReleases: true,
        separateMultipleMajor: true,
      },
      {
        separateMajorReleases: true,
      },
    );
  });

  it('should skip if separateMajorReleases does not exist', () => {
    expect(SeparateMultipleMajorMigration).toMigrate(
      {
        separateMultipleMajor: true,
      },
      {
        separateMultipleMajor: true,
      },
      false,
    );
  });
});

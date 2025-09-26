import { PinVersionsMigration } from './pin-versions-migration';

describe('config/migrations/custom/pin-versions-migration', () => {
  it('should migrate true', async () => {
    await expect(PinVersionsMigration).toMigrate(
      {
        pinVersions: true,
      },
      {
        rangeStrategy: 'pin',
      },
    );
  });

  it('should migrate false', async () => {
    await expect(PinVersionsMigration).toMigrate(
      {
        pinVersions: false,
      },
      {
        rangeStrategy: 'replace',
      },
    );
  });
});

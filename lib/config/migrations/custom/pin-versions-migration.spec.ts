import { PinVersionsMigration } from './pin-versions-migration';

describe('config/migrations/custom/pin-versions-migration', () => {
  it('should migrate true', () => {
    expect(PinVersionsMigration).toMigrate(
      {
        pinVersions: true,
      },
      {
        rangeStrategy: 'pin',
      },
    );
  });

  it('should migrate false', () => {
    expect(PinVersionsMigration).toMigrate(
      {
        pinVersions: false,
      },
      {
        rangeStrategy: 'replace',
      },
    );
  });
});

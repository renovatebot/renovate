import { validateCustomMigration } from '../validator';
import { PinVersionsMigration } from './pin-versions-migration';

describe('config/migrations/custom/pin-versions-migration', () => {
  it('should migrate true', () => {
    validateCustomMigration(
      PinVersionsMigration,
      {
        pinVersions: true,
      },
      {
        rangeStrategy: 'pin',
      }
    );
  });

  it('should migrate false', () => {
    validateCustomMigration(
      PinVersionsMigration,
      {
        pinVersions: false,
      },
      {
        rangeStrategy: 'replace',
      }
    );
  });
});

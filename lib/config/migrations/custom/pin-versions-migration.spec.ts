import { getCustomMigrationValidator } from '../validator';
import { PinVersionsMigration } from './pin-versions-migration';

describe('config/migrations/custom/pin-versions-migration', () => {
  const validate = getCustomMigrationValidator(PinVersionsMigration);

  it('should migrate true', () => {
    validate(
      {
        pinVersions: true,
      },
      {
        rangeStrategy: 'pin',
      }
    );
  });

  it('should migrate false', () => {
    validate(
      {
        pinVersions: false,
      },
      {
        rangeStrategy: 'replace',
      }
    );
  });
});

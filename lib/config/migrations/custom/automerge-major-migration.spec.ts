import { MigrationsService } from '../migrations-service';
import { AutomergeMajorMigration } from './automerge-major-migration';

describe('config/migrations/custom/automerge-major-migration', () => {
  it('should migrate value to object', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automergeMajor: 'some-value',
      },
      AutomergeMajorMigration
    );

    expect(migratedConfig.major.automerge).toBeTrue();
  });
});

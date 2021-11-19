import { RenovateConfig } from '../../types';
import { MigrationsService } from '../migrations-service';
import { AbstractMigration } from './abstract-migration';

class FakeMigration extends AbstractMigration {
  readonly propertyName = 'old';

  override run(): void {
    this.setSafely('new', 'new value');
  }
}

describe('config/migrations/base/abstract-migration', () => {
  it('set property value if it is not provided by user', () => {
    const migratedConfig: RenovateConfig = {};
    const fakeMigration = new FakeMigration(
      { old: 'old value' },
      migratedConfig
    );
    MigrationsService.run({ old: 'old value' }, migratedConfig, [
      fakeMigration,
    ]);
    expect(migratedConfig.new).toBe('new value');
  });

  it('do not set property value if it is provided by user', () => {
    const migratedConfig: RenovateConfig = {};
    const fakeMigration = new FakeMigration(
      { old: 'old value', new: 'another value' },
      migratedConfig
    );
    MigrationsService.run(
      { old: 'old value', new: 'another value' },
      migratedConfig,
      [fakeMigration]
    );
    expect(migratedConfig.new).toBe('another value');
  });
});

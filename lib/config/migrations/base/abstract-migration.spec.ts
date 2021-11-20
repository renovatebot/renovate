import { MigrationsService } from '../migrations-service';
import { AbstractMigration } from './abstract-migration';

class FakeMigration extends AbstractMigration {
  readonly propertyName = 'old';

  override run(): void {
    this.setSafely('new', 'new value');
  }
}

describe('config/migrations/base/abstract-migration', () => {
  it('set property value if it is undefined', () => {
    const migratedConfig = MigrationsService.runMigration(
      { old: 'old value' },
      FakeMigration
    );
    expect(migratedConfig.new).toBe('new value');
  });

  it('set property value if it is null', () => {
    const migratedConfig = MigrationsService.runMigration(
      { old: 'old value', new: null },
      FakeMigration
    );
    expect(migratedConfig.new).toBe('new value');
  });

  it('do not set property value if it is provided by user', () => {
    const migratedConfig = MigrationsService.runMigration(
      { old: 'old value', new: 'another value' },
      FakeMigration
    );
    expect(migratedConfig.new).toBe('another value');
  });
});

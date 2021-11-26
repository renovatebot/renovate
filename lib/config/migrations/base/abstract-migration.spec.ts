import { MigrationsService } from '../migrations-service';
import { AbstractMigration } from './abstract-migration';

class FakeMigration extends AbstractMigration {
  readonly propertyName = 'old';

  override run(): void {
    this.setSafely('new', 'new value');
  }
}

class FakeRegExpMigrationDelete extends AbstractMigration {
  readonly propertyName = /test/;

  override run(): void {
    this.delete();
  }
}

class FakeRegExpMigrationRewrite extends AbstractMigration {
  readonly propertyName = /test/;

  override run(): void {
    this.rewrite(1);
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

  it('should throw an error to incorrect usage of delete method', () => {
    const instance = new FakeRegExpMigrationDelete({}, {});

    expect(() => instance.run()).toThrow(
      'FakeRegExpMigrationDelete: invalid property name'
    );
  });

  it('should throw an error to incorrect usage of rewrite method', () => {
    const instance = new FakeRegExpMigrationRewrite({}, {});

    expect(() => instance.run()).toThrow(
      'FakeRegExpMigrationRewrite: invalid property name'
    );
  });
});

import fs from 'node:fs';
import { join } from 'upath';
import type { RenovateConfig } from '../types';
import { AbstractMigration } from './base/abstract-migration';
import { MigrationsService } from './migrations-service';
import type { Migration } from './types';

describe('config/migrations/migrations-service', () => {
  it('should remove deprecated properties', () => {
    for (const property of MigrationsService.removedProperties) {
      const originalConfig: RenovateConfig = {
        [property]: 'test',
      };

      const migratedConfig = MigrationsService.run(originalConfig);
      expect(
        MigrationsService.isMigrated(originalConfig, migratedConfig),
      ).toBeTrue();
      expect(migratedConfig).toEqual({});
    }
  });

  it('should rename renamed properties', () => {
    for (const [
      oldPropertyName,
      newPropertyName,
    ] of MigrationsService.renamedProperties.entries()) {
      const originalConfig: RenovateConfig = {
        [oldPropertyName]: 'test',
      };

      const migratedConfig = MigrationsService.run(originalConfig);
      expect(
        MigrationsService.isMigrated(originalConfig, migratedConfig),
      ).toBeTrue();
      expect(migratedConfig).toEqual({
        [newPropertyName]: 'test',
      });
    }
  });

  it('should save original order of properties', () => {
    const originalConfig: RenovateConfig = {
      exposeEnv: true,
      versionScheme: 'test',
      excludedPackageNames: ['test'],
    };
    const migratedConfig = MigrationsService.run(originalConfig);

    const mappedProperties = Object.keys(originalConfig).map((property) =>
      MigrationsService.renamedProperties.get(property),
    );

    expect(
      MigrationsService.isMigrated(originalConfig, migratedConfig),
    ).toBeTrue();
    expect(mappedProperties).toEqual(Object.keys(migratedConfig));
  });

  it('should allow custom migrations by regexp', () => {
    let isMigrationDone = false;
    const originalConfig: RenovateConfig = {
      fooBar: 'one',
    };
    class CustomMigration extends AbstractMigration {
      override readonly deprecated = true;
      override readonly propertyName = /^foo/;

      override run(): void {
        isMigrationDone = true;
      }
    }

    class CustomMigrationsService extends MigrationsService {
      public static override getMigrations(
        original: RenovateConfig,
        migrated: RenovateConfig,
      ): ReadonlyArray<Migration> {
        return [new CustomMigration(original, migrated)];
      }
    }

    const migratedConfig = CustomMigrationsService.run(originalConfig);
    expect(migratedConfig).toEqual({});
    expect(isMigrationDone).toBeTrue();
  });

  it('there should be a single migration per property name', () => {
    const migrations = MigrationsService.getMigrations({}, {});

    const set = new Set<string | RegExp>();
    const duplicateProperties: (string | RegExp)[] = [];
    for (const { propertyName } of migrations) {
      if (set.has(propertyName)) {
        duplicateProperties.push(propertyName);
        continue;
      }
      set.add(propertyName);
    }
    expect(duplicateProperties).toBeEmptyArray();
  });

  it('includes all defined migration classes in MigrationsService.customMigrations', () => {
    const allDefinedMigrationClasses: string[] = fs
      .readdirSync(join(__dirname, 'custom'), { withFileTypes: true })
      .map((file) => file.name)
      .filter((name) => !name.includes('spec.ts'));

    expect(MigrationsService.customMigrations).toHaveLength(
      allDefinedMigrationClasses.length,
    );
  });
});

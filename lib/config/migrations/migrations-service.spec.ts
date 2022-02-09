import type { RenovateConfig } from '../types';
import { MigrationsService } from './migrations-service';

describe('config/migrations/migrations-service', () => {
  it('should remove deprecated properties', () => {
    for (const property of MigrationsService.removedProperties) {
      const originalConfig: RenovateConfig = {
        [property]: 'test',
      };

      const migratedConfig = MigrationsService.run(originalConfig);
      expect(
        MigrationsService.isMigrated(originalConfig, migratedConfig)
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
        MigrationsService.isMigrated(originalConfig, migratedConfig)
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
      MigrationsService.renamedProperties.get(property)
    );

    expect(
      MigrationsService.isMigrated(originalConfig, migratedConfig)
    ).toBeTrue();
    expect(mappedProperties).toEqual(Object.keys(migratedConfig));
  });
});

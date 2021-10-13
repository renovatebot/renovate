import type { RenovateConfig } from '../types';
import { MigrationsService } from './migrations-service';

describe('config/migrations/migrations-service', () => {
  it('should remove deprecated properties', () => {
    for (const property of MigrationsService.removedProperties) {
      const originalConfig: Partial<RenovateConfig> = {
        [property]: 'test',
      };

      const migratedConfig = MigrationsService.run(originalConfig);
      expect(migratedConfig[property]).toBeUndefined();
    }
  });

  it('should rename renamed properties', () => {
    for (const [
      oldPropertyName,
      newPropertyName,
    ] of MigrationsService.renamedProperties.entries()) {
      const originalConfig: Partial<RenovateConfig> = {
        [oldPropertyName]: 'test',
      };

      const migratedConfig = MigrationsService.run(originalConfig);
      expect(migratedConfig[oldPropertyName]).toBeUndefined();
      expect(migratedConfig[newPropertyName]).toBe('test');
    }
  });
});

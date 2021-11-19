import type { RenovateConfig } from '../../types';
import type { Migration } from '../types';

export abstract class AbstractMigration implements Migration {
  abstract readonly propertyName: string;

  protected readonly originalConfig: RenovateConfig;

  protected readonly migratedConfig: RenovateConfig;

  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    this.originalConfig = originalConfig;
    this.migratedConfig = migratedConfig;
  }

  abstract run(): void;

  protected delete(property: string): void {
    delete this.migratedConfig[property];
  }
}

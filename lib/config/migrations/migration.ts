import type { RenovateConfig } from '../types';

export abstract class Migration {
  protected readonly originalConfig: RenovateConfig;

  protected readonly migratedConfig: RenovateConfig;

  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    this.originalConfig = originalConfig;
    this.migratedConfig = migratedConfig;
  }

  abstract migrate(): void;

  protected delete(property: string): void {
    delete this.migratedConfig[property];
  }
}

import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../types';

export abstract class AbstractMigration {
  abstract readonly propertyName: string;

  protected readonly originalConfig: RenovateConfig;

  protected readonly migratedConfig: RenovateConfig;

  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    this.originalConfig = originalConfig;
    this.migratedConfig = migratedConfig;
  }

  abstract run(value: unknown): void;

  protected delete(property: string): void {
    delete this.migratedConfig[property];
  }

  protected setSafely<Key extends keyof RenovateConfig>(
    property: Key,
    value: RenovateConfig[Key]
  ): void {
    if (
      is.nullOrUndefined(this.originalConfig[property]) &&
      is.nullOrUndefined(this.migratedConfig[property])
    ) {
      this.migratedConfig[property] = value;
    }
  }

  protected get<Key extends keyof RenovateConfig>(
    key: Key
  ): RenovateConfig[Key] {
    return this.migratedConfig[key] ?? this.originalConfig[key];
  }
}

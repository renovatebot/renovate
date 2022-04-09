import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../types';
import type { Migration } from '../types';

export abstract class AbstractMigration implements Migration {
  readonly deprecated: boolean = false;
  abstract readonly propertyName: string;
  private readonly originalConfig: RenovateConfig;
  private readonly migratedConfig: RenovateConfig;

  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    this.originalConfig = originalConfig;
    this.migratedConfig = migratedConfig;
  }

  abstract run(value: unknown): void;

  protected get<Key extends keyof RenovateConfig>(
    key: Key
  ): RenovateConfig[Key] {
    return this.migratedConfig[key] ?? this.originalConfig[key];
  }

  protected has<Key extends keyof RenovateConfig>(key: Key): boolean {
    return key in this.originalConfig;
  }

  protected setSafely<Key extends keyof RenovateConfig>(
    key: Key,
    value: RenovateConfig[Key]
  ): void {
    if (
      is.nullOrUndefined(this.originalConfig[key]) &&
      is.nullOrUndefined(this.migratedConfig[key])
    ) {
      this.migratedConfig[key] = value;
    }
  }

  protected setHard<Key extends keyof RenovateConfig>(
    key: Key,
    value: RenovateConfig[Key]
  ): void {
    this.migratedConfig[key] = value;
  }

  protected rewrite(value: unknown): void {
    this.setHard(this.propertyName, value);
  }

  protected delete(property = this.propertyName): void {
    delete this.migratedConfig[property];
  }
}

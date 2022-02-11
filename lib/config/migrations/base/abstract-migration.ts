import is from '@sindresorhus/is';
import type { DeprecatedRenovateConfig, Migration } from '../types';

export abstract class AbstractMigration<
  TConfig extends DeprecatedRenovateConfig = DeprecatedRenovateConfig
> implements Migration<TConfig>
{
  readonly deprecated: boolean = false;
  abstract readonly propertyName: keyof TConfig;
  private readonly originalConfig: TConfig;
  private readonly migratedConfig: TConfig;

  constructor(originalConfig: TConfig, migratedConfig: TConfig) {
    this.originalConfig = originalConfig;
    this.migratedConfig = migratedConfig;
  }

  abstract run(value: unknown): void;

  protected get<Key extends keyof TConfig>(key: Key): TConfig[Key] {
    return this.migratedConfig[key] ?? this.originalConfig[key];
  }

  protected setSafely<Key extends keyof TConfig>(
    key: Key,
    value: TConfig[Key]
  ): void {
    if (
      is.nullOrUndefined(this.originalConfig[key]) &&
      is.nullOrUndefined(this.migratedConfig[key])
    ) {
      this.migratedConfig[key] = value;
    }
  }

  protected setHard<Key extends keyof TConfig>(
    key: Key,
    value: TConfig[Key]
  ): void {
    this.migratedConfig[key] = value;
  }

  protected rewrite(value: unknown): void {
    // TODO: fix types (#9610)
    this.setHard(this.propertyName, value as never);
  }

  protected delete(property: keyof TConfig): void {
    delete this.migratedConfig[property];
  }
}

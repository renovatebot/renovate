import { isNullOrUndefined, isString } from '@sindresorhus/is';
import type { AllConfig, RenovateConfig } from '../../types';
import type { MigratableConfig, Migration } from '../types';

export abstract class AbstractMigration<T extends RenovateConfig = AllConfig>
  implements Migration
{
  readonly deprecated: boolean = false;
  abstract readonly propertyName: string | RegExp;
  private readonly originalConfig: MigratableConfig<T>;
  private readonly migratedConfig: MigratableConfig<T>;

  constructor(
    originalConfig: MigratableConfig<T>,
    migratedConfig: MigratableConfig<T>,
  ) {
    this.originalConfig = originalConfig;
    this.migratedConfig = migratedConfig;
  }

  abstract run(value: unknown, key: string): void;

  protected get<Key extends keyof MigratableConfig<T>>(
    key: Key,
  ): MigratableConfig<T>[Key] {
    return this.migratedConfig[key] ?? this.originalConfig[key];
  }

  protected has<Key extends keyof T | string>(key: Key): boolean {
    return key in this.originalConfig;
  }

  protected setSafely<Key extends keyof MigratableConfig<T>>(
    key: Key,
    value: MigratableConfig<T>[Key],
  ): void {
    if (
      isNullOrUndefined(this.originalConfig[key]) &&
      isNullOrUndefined(this.migratedConfig[key])
    ) {
      this.migratedConfig[key] = value;
    }
  }

  protected setHard<Key extends keyof MigratableConfig<T>>(
    key: Key,
    value: MigratableConfig<T>[Key],
  ): void {
    this.migratedConfig[key] = value;
  }

  protected rewrite(value: unknown): void {
    if (!isString(this.propertyName)) {
      throw new Error();
    }

    // TODO: fix types
    this.setHard(
      this.propertyName as keyof MigratableConfig<T>,
      value as never,
    );
  }

  protected delete(property = this.propertyName): void {
    if (!isString(property)) {
      throw new Error();
    }

    // TODO: fix types
    delete this.migratedConfig[property as keyof MigratableConfig<T>];
  }
}

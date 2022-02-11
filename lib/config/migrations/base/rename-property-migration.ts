import type { DeprecatedRenovateConfig } from '../types';
import { AbstractMigration } from './abstract-migration';

export class RenamePropertyMigration<
  TConfig extends DeprecatedRenovateConfig = DeprecatedRenovateConfig
> extends AbstractMigration<TConfig> {
  override readonly deprecated = true;
  override readonly propertyName: keyof TConfig;

  private readonly newPropertyName: keyof TConfig;

  constructor(
    deprecatedPropertyName: keyof TConfig,
    newPropertyName: keyof TConfig,
    originalConfig: TConfig,
    migratedConfig: TConfig
  ) {
    super(originalConfig, migratedConfig);
    this.propertyName = deprecatedPropertyName;
    this.newPropertyName = newPropertyName;
  }

  override run(value: unknown): void {
    // TODO: fix types (#9610)
    this.setSafely(this.newPropertyName, value as never);
  }
}

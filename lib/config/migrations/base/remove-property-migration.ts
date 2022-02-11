import type { DeprecatedRenovateConfig } from '../types';
import { AbstractMigration } from './abstract-migration';

export class RemovePropertyMigration<
  TConfig extends DeprecatedRenovateConfig = DeprecatedRenovateConfig
> extends AbstractMigration<TConfig> {
  override readonly propertyName: keyof TConfig;

  constructor(
    propertyName: keyof TConfig,
    originalConfig: TConfig,
    migratedConfig: TConfig
  ) {
    super(originalConfig, migratedConfig);
    this.propertyName = propertyName;
  }

  override run(): void {
    this.delete(this.propertyName);
  }
}

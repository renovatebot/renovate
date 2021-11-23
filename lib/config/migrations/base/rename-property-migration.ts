import type { RenovateConfig } from '../../types';
import { AbstractMigration } from './abstract-migration';

export class RenamePropertyMigration extends AbstractMigration {
  readonly propertyName: string;

  private readonly newPropertyName: string;

  constructor(
    deprecatedPropertyName: string,
    newPropertyName: string,
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ) {
    super(originalConfig, migratedConfig);
    this.propertyName = deprecatedPropertyName;
    this.newPropertyName = newPropertyName;
  }

  override run(value): void {
    this.delete();

    this.setSafely(this.newPropertyName, value);
  }
}

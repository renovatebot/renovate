import type { RenovateConfig } from '../../types';
import { AbstractMigration } from './abstract-migration';

export class RenamePropertyMigration extends AbstractMigration {
  protected readonly newPropertyName: string;

  constructor(
    deprecatedPropertyName: string,
    newPropertyName: string,
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ) {
    super(deprecatedPropertyName, originalConfig, migratedConfig);
    this.newPropertyName = newPropertyName;
  }

  override run(): void {
    this.delete(this.propertyName);

    this.migratedConfig[this.newPropertyName] =
      this.originalConfig[this.propertyName];
  }
}

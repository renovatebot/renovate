import type { RenovateConfigFile } from '../../types.ts';
import { AbstractMigration } from './abstract-migration.ts';

export class RenamePropertyMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName: string;

  private readonly newPropertyName: string;

  constructor(
    deprecatedPropertyName: string,
    newPropertyName: string,
    originalConfig: RenovateConfigFile,
    migratedConfig: RenovateConfigFile,
  ) {
    super(originalConfig, migratedConfig);
    this.propertyName = deprecatedPropertyName;
    this.newPropertyName = newPropertyName;
  }

  override run(value: unknown): void {
    this.setSafely(this.newPropertyName as keyof RenovateConfigFile, value);
  }
}

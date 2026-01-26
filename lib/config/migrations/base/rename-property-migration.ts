import type { RenovateConfig } from '../../types.ts';
import { AbstractMigration } from './abstract-migration.ts';

export class RenamePropertyMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName: string;

  private readonly newPropertyName: string;

  constructor(
    deprecatedPropertyName: string,
    newPropertyName: string,
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig,
  ) {
    super(originalConfig, migratedConfig);
    this.propertyName = deprecatedPropertyName;
    this.newPropertyName = newPropertyName;
  }

  override run(value: unknown): void {
    this.setSafely(this.newPropertyName as keyof RenovateConfig, value);
  }
}

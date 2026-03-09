import type { RenovateConfig } from '../../types.ts';
import { AbstractMigration } from './abstract-migration.ts';

export class RemovePropertyMigration extends AbstractMigration {
  override readonly propertyName: string;

  constructor(
    propertyName: string,
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig,
  ) {
    super(originalConfig, migratedConfig);
    this.propertyName = propertyName;
  }

  override run(): void {
    this.delete(this.propertyName);
  }
}

import type { RenovateConfig } from '../../types';
import { AbstractMigration } from './abstract-migration';

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

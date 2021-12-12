import type { RenovateConfig } from '../../types';
import { AbstractMigration } from './abstract-migration';

export class RemovePropertyMigration extends AbstractMigration {
  readonly propertyName: string;

  constructor(
    propertyName: string,
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ) {
    super(originalConfig, migratedConfig);
    this.propertyName = propertyName;
  }

  run(): void {
    this.delete(this.propertyName);
  }
}

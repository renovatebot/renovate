import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class PinVersionsMigration extends AbstractMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super('pinVersions', originalConfig, migratedConfig);
  }

  override run(): void {
    const { pinVersions } = this.originalConfig;
    this.delete(this.propertyName);

    if (is.boolean(pinVersions)) {
      this.migratedConfig.rangeStrategy = pinVersions ? 'pin' : 'replace';
    }
  }
}

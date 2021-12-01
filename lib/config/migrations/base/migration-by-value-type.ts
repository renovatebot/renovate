import is from '@sindresorhus/is';
import { getOptionType } from '../../options';
import type { RenovateConfig } from '../../types';
import { AbstractMigration } from './abstract-migration';

export class MigrationByValueType extends AbstractMigration {
  readonly propertyName: string;

  constructor(
    propertyName: string,
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ) {
    super(originalConfig, migratedConfig);
    this.propertyName = propertyName;
  }

  override run(value): void {
    const type = getOptionType(this.propertyName);

    switch (type) {
      case 'object':
        if (is.boolean(value)) {
          this.rewrite({ enabled: value });
        }
        break;

      case 'boolean':
        if (value === 'true') {
          this.rewrite(true);
        } else if (value === 'false') {
          this.rewrite(false);
        }
        break;

      case 'string':
        if (Array.isArray(value) && value.length === 1) {
          this.rewrite(String(value[0]));
        }
        break;
    }
  }
}

import { isBoolean } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class RecreateClosedMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'recreateClosed';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (isBoolean(value)) {
      this.setSafely('recreateWhen', value ? 'always' : 'auto');
    }
  }
}

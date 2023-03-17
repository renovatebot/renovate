import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class IncludeForksMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'includeForks';

  override run(value: unknown): void {
    if (is.boolean(value)) {
      this.setSafely('forkProcessing', value ? 'enabled' : 'disabled');
    }
  }
}

import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class RecreateClosedMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'recreateClosed';

  override run(value: unknown): void {
    if (is.boolean(value)) {
      this.setSafely('recreateWhen', value ? 'always' : 'auto');
    }
  }
}

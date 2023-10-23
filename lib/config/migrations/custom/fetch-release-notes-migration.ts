import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class FetchChangeLogsMigration extends AbstractMigration {
  override readonly propertyName = 'fetchChangeLogs';

  override run(value: unknown): void {
    if (is.boolean(value)) {
      this.rewrite(value ? 'pr' : 'off');
    }
  }
}

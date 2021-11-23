import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class AutomergeTypeMigration extends AbstractMigration {
  readonly propertyName = 'automergeType';

  override run(value): void {
    if (is.string(value) && value.startsWith('branch-')) {
      this.rewrite('branch');
    }
  }
}

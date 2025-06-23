import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class AutomergeTypeMigration extends AbstractMigration {
  override readonly propertyName = 'automergeType';

  override run(value: unknown): void {
    if (is.string(value) && value.startsWith('branch-')) {
      this.rewrite('branch');
    }
  }
}

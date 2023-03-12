import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class BaseBranchMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'baseBranch';

  override run(value: unknown): void {
    if (is.array<string>(value)) {
      this.setSafely('baseBranches', value);
    }
    if (is.string(value)) {
      this.setSafely('baseBranches', [value]);
    }
  }
}

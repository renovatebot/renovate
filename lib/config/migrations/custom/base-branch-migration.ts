import { isArray, isString } from '@sindresorhus/is';
import { coerceArray } from '../../../util/array.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class BaseBranchMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'baseBranch';

  override run(value: unknown): void {
    const baseBranchPatterns = coerceArray(this.get('baseBranchPatterns'));
    if (isArray<string>(value)) {
      this.setHard('baseBranchPatterns', baseBranchPatterns.concat(value));
    }
    if (isString(value)) {
      this.setHard('baseBranchPatterns', baseBranchPatterns.concat([value]));
    }
  }
}

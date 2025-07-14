import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class BaseBranchMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'baseBranch';

  override run(value: unknown): void {
    const baseBranchPatterns = this.get('baseBranchPatterns') ?? [];
    if (is.array<string>(value)) {
      this.setHard('baseBranchPatterns', baseBranchPatterns.concat(value));
    }
    if (is.string(value)) {
      this.setHard('baseBranchPatterns', baseBranchPatterns.concat([value]));
    }
  }
}

import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class BaseBranchesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'baseBranches';

  override run(value: unknown): void {
    const baseBranchPatterns = this.get('baseBranchPatterns') ?? [];
    if (is.array<string>(value)) {
      this.setHard('baseBranchPatterns', baseBranchPatterns.concat(value));
    }
  }
}

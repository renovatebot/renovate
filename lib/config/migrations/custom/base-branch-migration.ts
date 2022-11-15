import { AbstractMigration } from '../base/abstract-migration';

export class BaseBranchMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'baseBranch';

  override run(value: unknown): void {
    this.setSafely('baseBranches', Array.isArray(value) ? value : [value]);
  }
}

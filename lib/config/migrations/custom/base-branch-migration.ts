import { AbstractMigration } from '../base/abstract-migration';

export class BaseBranchMigration extends AbstractMigration {
  readonly propertyName = 'baseBranch';

  override run(value): void {
    this.delete();
    this.setSafely('baseBranches', Array.isArray(value) ? value : [value]);
  }
}

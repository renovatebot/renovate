import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class GitlabIgnoreApprovalsractMigration extends AbstractMigration {
  override readonly propertyName = 'gitLabIgnoreApprovals';

  override run(value: unknown, key: string, parentKey?: string): void {
    if (is.boolean(value) && parentKey !== 'platformOptions') {
      const platformOptions = this.get('platformOptions') ?? {};
      this.delete();
      this.setHard('platformOptions', {
        ...platformOptions,
        gitLabIgnoreApprovals: value,
      });
    }
  }
}

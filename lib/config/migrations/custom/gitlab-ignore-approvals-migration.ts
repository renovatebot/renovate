import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class GitlabIgnoreApprovalsractMigration extends AbstractMigration {
  override readonly propertyName = 'gitLabIgnoreApprovals';

  override run(value: unknown, key: string, parentKey?: string): void {
    if (is.boolean(value) && parentKey !== 'prOptions') {
      const prOptions = this.get('prOptions') ?? {};
      this.delete();
      this.setHard('prOptions', {
        ...prOptions,
        gitLabIgnoreApprovals: value,
      });
    }
  }
}

import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class BranchNameMigration extends AbstractMigration {
  readonly propertyName = 'branchName';

  override run(value): void {
    if (is.string(value) && value.includes('{{managerBranchPrefix}}')) {
      this.rewrite(
        value.replace('{{managerBranchPrefix}}', '{{additionalBranchPrefix}}')
      );
    }
  }
}

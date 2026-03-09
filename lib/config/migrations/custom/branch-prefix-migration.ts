import { isString } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class BranchPrefixMigration extends AbstractMigration {
  override readonly propertyName = 'branchPrefix';

  override run(value: unknown): void {
    if (isString(value) && value.includes('{{')) {
      const templateIndex = value.indexOf(`{{`);
      this.rewrite(value.substring(0, templateIndex));
      this.setHard('additionalBranchPrefix', value.substring(templateIndex));
    }
  }
}

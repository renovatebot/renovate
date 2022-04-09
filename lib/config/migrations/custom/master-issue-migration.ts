import { getOptionType } from '../../options';
import { AbstractMigration } from '../base/abstract-migration';

export class MasterIssueMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = /^masterIssue/;

  override run(value: unknown, key: string): void {
    const newKey = key.replace('masterIssue', 'dependencyDashboard');
    const isTrue = getOptionType(newKey) === 'boolean' && value === 'true';

    this.setSafely(newKey, isTrue ? true : value);
  }
}

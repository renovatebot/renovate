import { getOptionType } from '../../options';
import { AbstractMigration } from '../base/abstract-migration';

export class MasterIssueMigration extends AbstractMigration {
  readonly propertyName = /^masterIssue/;

  override run(value, key): void {
    this.delete(key);
    const newKey = key.replace('masterIssue', 'dependencyDashboard');
    const isTrue = getOptionType(newKey) === 'boolean' && value === 'true';

    this.setSafely(newKey, isTrue ? true : value);
  }
}

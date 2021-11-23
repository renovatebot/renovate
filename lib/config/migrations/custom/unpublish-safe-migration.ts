import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class UnpublishSafeMigration extends AbstractMigration {
  readonly propertyName = 'unpublishSafe';

  override run(value): void {
    let extendsValue = this.get('extends') ?? [];
    this.delete();

    if (value === true) {
      if (is.string(extendsValue)) {
        extendsValue = [extendsValue];
      }
      if (
        ![':unpublishSafe', 'default:unpublishSafe', 'npm:unpublishSafe'].some(
          (x) => extendsValue.includes(x)
        )
      ) {
        extendsValue.push('npm:unpublishSafe');
      }
      this.setHard('extends', extendsValue);
    }
  }
}

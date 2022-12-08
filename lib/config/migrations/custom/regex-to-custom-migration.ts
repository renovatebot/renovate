import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class RegexCustomMigration extends AbstractMigration {
  override readonly propertyName = 'enabledManagers';

  override run(value: unknown): void {
    if (is.array(value)) {
      let managers = value;
      managers = managers.map((manager) =>
        manager === 'regex' ? 'custom' : manager
      );
      this.rewrite(managers);
    }
  }
}

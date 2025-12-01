import { isArray, isString } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchManagersMigration extends AbstractMigration {
  override readonly propertyName = 'matchManagers';

  override run(value: unknown): void {
    if (!isArray<string>(value, isString)) {
      return;
    }

    // prefix custom. before custom managers if not present
    const newValue = value.map((manager) =>
      manager === 'regex' ? 'custom.regex' : manager,
    );
    this.rewrite(newValue);
  }
}

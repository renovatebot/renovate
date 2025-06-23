import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class MatchManagersMigration extends AbstractMigration {
  override readonly propertyName = 'matchManagers';

  override run(value: unknown): void {
    if (!is.array<string>(value, is.string)) {
      return;
    }

    // prefix custom. before custom managers if not present
    const newValue = value.map((manager) =>
      manager === 'regex' ? 'custom.regex' : manager,
    );
    this.rewrite(newValue);
  }
}

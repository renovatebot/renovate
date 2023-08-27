import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';
import { isCustomManager } from '../../../modules/manager/custom';

export class MatchManagersMigration extends AbstractMigration {
  override readonly propertyName = 'matchManagers';

  override run(value: unknown): void {
    if (!is.array<string>(value, is.string)) {
      return;
    }

    const newValue = value.map((manager) =>
      isCustomManager(manager) ? `custom.${manager}` : manager
    );
    this.rewrite(newValue);
  }
}

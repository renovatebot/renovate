import is from '@sindresorhus/is';
import { isCustomManager } from '../../../modules/manager/custom';
import { AbstractMigration } from '../base/abstract-migration';

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

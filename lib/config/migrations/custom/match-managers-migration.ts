import { isArray, isString } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class MatchManagersMigration extends AbstractMigration {
  override readonly propertyName = 'matchManagers';

  override run(value: unknown): void {
    if (!isArray<string>(value, isString)) {
      return;
    }

    const newValue = value.map((manager) => {
      switch (manager) {
        // prefix custom. before custom managers if not present
        case 'regex':
          return 'custom.regex';
        case 'renovate-config-presets':
          return 'renovate-config';
        default:
          return manager;
      }
    });
    this.rewrite(newValue);
  }
}

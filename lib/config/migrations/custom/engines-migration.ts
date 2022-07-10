import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class EnginesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'engines';

  override run(value: unknown): void {
    if (is.nonEmptyObject(value)) {
      const packageRules: PackageRule[] = this.get('packageRules') ?? [];

      packageRules.push({
        matchDepTypes: ['engines'],
        ...value,
      } as PackageRule);

      if (packageRules.length) {
        this.setHard('packageRules', packageRules);
      }
    }
  }
}

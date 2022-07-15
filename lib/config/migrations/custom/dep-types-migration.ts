import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class DepTypesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = /.*[d|D]ependencies$|engines$|depTypes$/;

  override run(value: unknown, key: string): void {
    const packageRules: PackageRule[] = this.get('packageRules') ?? [];
    if (is.nonEmptyObject(value) && !is.array(value)) {
      packageRules.push({
        matchDepTypes: [key],
        ...value,
      } as PackageRule);
    }

    if (is.array(value)) {
      for (const depType of value) {
        if (is.object(depType) && !is.array(depType)) {
          const depTypeName = (depType as any).depType;
          if (depTypeName) {
            delete (depType as any).depType;
            (depType as any).matchDepTypes = [depTypeName];
            packageRules.push({ ...(depType as PackageRule) });
          }
        }
      }
    }

    if (packageRules.length) {
      this.setHard('packageRules', packageRules);
    }
  }
}

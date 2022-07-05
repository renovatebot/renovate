import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

const depTypes = [
  'dependencies',
  'devDependencies',
  'engines',
  'optionalDependencies',
  'peerDependencies',
];
export class DepTypesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'depTypes';

  override run(value: unknown): void {
    const packageRules: PackageRule[] = this.get('packageRules') ?? [];
    if (is.array(value)) {
      for (const depType of value) {
        if (is.object(depType) && !is.array(depType)) {
          const depTypeName = (depType as any).depType;
          if (depTypeName) {
            delete (depType as any).depType;
            (depType as any).depTypeList = [depTypeName];
            packageRules.push({ ...(depType as PackageRule) });
          }
        }
      }
    }

    for (const depType of depTypes) {
      const val = this.get(depType);
      if (is.nonEmptyObject(val)) {
        delete (depType as any).depType;
        (val as any).depTypeList = [depType];

        packageRules.push({ ...(val as PackageRule) });
        this.delete(depType);
      }
    }

    if (packageRules.length) {
      this.setSafely('packageRules', packageRules);
    }
  }
}

import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

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
            delete (depType as PackageRuleInputConfig).depType;
            (depType as any).depTypeList = [depTypeName];
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

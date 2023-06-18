import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

interface DepTypesRule extends PackageRule, PackageRuleInputConfig {}

export class DepTypesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName =
    /^(?:(?:d|devD|optionalD|peerD)ependencies|engines|depTypes)$/;

  override run(value: unknown, key: string): void {
    const packageRules: PackageRule[] = this.get('packageRules') ?? [];
    if (is.nonEmptyObject(value) && !is.array(value)) {
      packageRules.push({
        matchDepTypes: [key],
        ...value,
      });
    }

    if (is.array(value)) {
      for (const depType of value as DepTypesRule[]) {
        if (is.object(depType) && !is.array(depType)) {
          const depTypeName = depType.depType;
          if (depTypeName) {
            delete depType.depType;
            depType.matchDepTypes = [depTypeName];
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

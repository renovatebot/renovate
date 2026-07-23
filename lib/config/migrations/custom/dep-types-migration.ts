import { isArray, isNonEmptyObject, isObject } from '@sindresorhus/is';
import type { PackageRule } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

interface DepTypesRule extends PackageRule {
  depType?: string;
}

export class DepTypesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName =
    // oxlint-disable-next-line renovate/require-regex-util -- must stay a native RegExp: MigrationsService matches propertyName via isRegExp(), which RE2 instances fail
    /^(?:(?:d|devD|optionalD|peerD)ependencies|engines|depTypes)$/;

  override run(value: unknown, key: string): void {
    const packageRules: PackageRule[] = this.get('packageRules') ?? [];
    if (isNonEmptyObject(value) && !isArray(value)) {
      packageRules.push({
        matchDepTypes: [key],
        ...value,
      });
    }

    if (isArray(value)) {
      for (const depType of value as DepTypesRule[]) {
        if (isObject(depType) && !isArray(depType)) {
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

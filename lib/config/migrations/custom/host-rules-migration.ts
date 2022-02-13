import is from '@sindresorhus/is';
import type { HostRule } from '../../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class HostRulesMigration extends AbstractMigration {
  override readonly propertyName = 'hostRules';

  override run(value: Record<string, unknown>[]): void {
    const newHostRules: HostRule[] = value.map((rule) => {
      const newRule: HostRule = {};

      for (const [key, value] of Object.entries(rule)) {
        if (key === 'platform') {
          if (is.string(value)) {
            newRule.hostType ??= value;
          }
          continue;
        }

        if (
          key === 'endpoint' ||
          key === 'host' ||
          key === 'baseUrl' ||
          key === 'hostName' ||
          key === 'domainName'
        ) {
          if (is.string(value)) {
            newRule.matchHost ??= value;
          }
          continue;
        }

        newRule[key] = value;
      }

      return newRule;
    });

    this.rewrite(newHostRules);
  }
}

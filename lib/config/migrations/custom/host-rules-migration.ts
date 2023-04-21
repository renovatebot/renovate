import is from '@sindresorhus/is';
import type { HostRule } from '../../../types';
import { AbstractMigration } from '../base/abstract-migration';
import { migrateDatasource } from './datasource-migration';

export class HostRulesMigration extends AbstractMigration {
  override readonly propertyName = 'hostRules';

  override run(value: Record<string, unknown>[]): void {
    const newHostRules: HostRule[] = [];
    for (const hostRule of value) {
      const newRule: any = {};

      for (const [key, value] of Object.entries(hostRule)) {
        if (key === 'platform') {
          if (is.string(value)) {
            newRule.hostType ??= value;
          }
          continue;
        }

        if (key === 'matchHost') {
          if (is.string(value)) {
            newRule.matchHost ??= massageUrl(value);
          }
          continue;
        }

        if (key === 'hostType') {
          if (is.string(value)) {
            newRule.hostType ??= migrateDatasource(value);
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
            newRule.matchHost ??= massageUrl(value);
          }
          continue;
        }

        newRule[key] = value;
      }

      newHostRules.push(newRule);
    }

    this.rewrite(newHostRules);
  }
}

function massageUrl(url: string): string {
  if (!url.includes('://') && url.includes('/')) {
    return 'https://' + url;
  } else {
    return url;
  }
}

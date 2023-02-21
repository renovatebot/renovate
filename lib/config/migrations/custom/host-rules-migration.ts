import is from '@sindresorhus/is';
import type { HostRule } from '../../../types';
import { clone } from '../../../util/clone';
import { AbstractMigration } from '../base/abstract-migration';

interface LegacyHostRule {
  hostName?: string;
  domainName?: string;
  baseUrl?: string;
  host?: string;
  endpoint?: string;
}

export class HostRulesMigration extends AbstractMigration {
  override readonly propertyName = 'hostRules';

  override run(value: (LegacyHostRule & HostRule)[]): void {
    const newHostRules: HostRule[] = [];
    for (let hostRule of value) {
      hostRule = migrateRule(hostRule);

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

        newRule[key] = value;
      }

      newHostRules.push(newRule);
    }

    this.rewrite(newHostRules);
  }
}

function migrateRule(rule: LegacyHostRule & HostRule): HostRule {
  const cloned: LegacyHostRule & HostRule = clone(rule);
  delete cloned.hostName;
  delete cloned.domainName;
  delete cloned.baseUrl;
  delete cloned.endpoint;
  delete cloned.host;
  const result: HostRule = cloned;

  const { matchHost } = result;
  const { hostName, domainName, baseUrl, endpoint, host } = rule;
  const hostValues = [
    matchHost,
    hostName,
    domainName,
    baseUrl,
    endpoint,
    host,
  ].filter(Boolean);
  if (hostValues.length === 1) {
    const [matchHost] = hostValues;
    result.matchHost = massageUrl(matchHost!);
  } else if (hostValues.length > 1) {
    const error = new Error('config-validation');
    error.validationError = `hostRules cannot contain more than one host-matching field - use "matchHost" only.`;
    throw error;
  }

  return result;
}

function massageUrl(url: string): string {
  if (!url.includes('://') && url.includes('/')) {
    return 'https://' + url;
  } else {
    return url;
  }
}

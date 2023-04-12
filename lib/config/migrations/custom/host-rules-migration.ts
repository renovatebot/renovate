import is from '@sindresorhus/is';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import type { HostRule } from '../../../types';
import { clone } from '../../../util/clone';
import { AbstractMigration } from '../base/abstract-migration';
import { migrateDatasource } from './datasource-migration';

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
  ].filter(is.string);
  if (hostValues.length === 1) {
    const [matchHost] = hostValues;
    result.matchHost = massageUrl(matchHost);
  } else if (hostValues.length > 1) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = 'config';
    error.validationMessage = `hostRules cannot contain more than one host-matching field - use "matchHost" only.`;
    error.validationError =
      'The renovate configuration file contains some invalid settings';
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

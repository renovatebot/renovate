import is from '@sindresorhus/is';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import type { LegacyHostRule } from '../../../util/host-rules';
import { AbstractMigration } from '../base/abstract-migration';
import { migrateDatasource } from './datasource-migration';

export class HostRulesMigration extends AbstractMigration {
  override readonly propertyName = 'hostRules';

  override run(value: (LegacyHostRule & HostRule)[]): void {
    const newHostRules: HostRule[] = [];
    for (const hostRule of value) {
      validateHostRule(hostRule);
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

function validateHostRule(rule: LegacyHostRule & HostRule): void {
  const { matchHost, hostName, domainName, baseUrl, endpoint, host } = rule;
  const hosts: Record<string, string> = removeUndefinedFields({
    matchHost,
    hostName,
    domainName,
    baseUrl,
    endpoint,
    host,
  });

  if (Object.keys(hosts).length > 1) {
    const distinctHostValues = new Set(Object.values(hosts));
    // check if the host values are duplicated
    if (distinctHostValues.size > 1) {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'config';
      error.validationMessage =
        '`hostRules` cannot contain more than one host-matching field - use `matchHost` only.';
      error.validationError =
        'The renovate configuration file contains some invalid settings';
      throw error;
    } else {
      logger.warn(
        { hosts },
        'Duplicate host values found, please only use `matchHost` to specify the host',
      );
    }
  }
}

function massageUrl(url: string): string {
  if (!url.includes('://') && url.includes('/')) {
    return 'https://' + url;
  } else {
    return url;
  }
}

function removeUndefinedFields(
  obj: Record<string, any>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    if (is.string(obj[key])) {
      result[key] = obj[key];
    }
  }
  return result;
}

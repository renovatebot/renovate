import type { HostRule } from '../../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class HostRulesMigration extends AbstractMigration {
  override readonly propertyName = 'hostRules';

  override run(value: Record<string, unknown>[]): void {
    const newHostRules: HostRule[] = value.map((rule) => {
      const newRule = { ...rule };
      newRule.hostType ??= newRule.platform;
      newRule.matchHost ??=
        newRule.endpoint ||
        newRule.host ||
        newRule.baseUrl ||
        newRule.hostName ||
        newRule.domainName;

      delete newRule.platform;
      delete newRule.endpoint;
      delete newRule.host;
      delete newRule.baseUrl;
      delete newRule.hostName;
      delete newRule.domainName;

      return newRule;
    });

    this.rewrite(newHostRules);
  }
}

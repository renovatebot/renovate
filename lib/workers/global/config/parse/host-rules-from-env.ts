import { getDatasourceList } from '../../../../datasource';
import { logger } from '../../../../logger';
import type { HostRule } from '../../../../types';

export function hostRulesFromEnv(env: NodeJS.ProcessEnv): HostRule[] {
  const datasources = new Set(getDatasourceList());
  const fields = ['token', 'username', 'password'];

  const hostRules: HostRule[] = [];

  const npmEnvPrefixes = ['npm_config_', 'npm_lifecycle_', 'npm_package_'];

  for (const envName of Object.keys(env).sort()) {
    if (npmEnvPrefixes.some((prefix) => envName.startsWith(prefix))) {
      logger.trace('Ignoring npm env: ' + envName);
      continue;
    }
    // Double underscore __ is used in place of hyphen -
    const splitEnv = envName.toLowerCase().replace(/__/g, '-').split('_');
    const hostType = splitEnv.shift();
    if (hostType && datasources.has(hostType)) {
      const suffix = splitEnv.pop() as keyof HostRule;
      if (fields.includes(suffix)) {
        let matchHost: string | undefined;
        const rule: HostRule = {};
        rule[suffix] = env[envName] as never; // TODO: fix types (#9610)
        if (splitEnv.length === 0) {
          // host-less rule
        } else if (splitEnv.length === 1) {
          logger.warn(`Cannot parse ${envName} env`);
          continue;
        } else {
          matchHost = splitEnv.join('.');
        }
        const existingRule = hostRules.find(
          (hr) => hr.hostType === hostType && hr.matchHost === matchHost
        );
        logger.debug(`Converting ${envName} into a global host rule`);
        if (existingRule) {
          // Add current field to existing rule
          existingRule[suffix] = env[envName] as never; // TODO: fix types (#9610)
        } else {
          // Create a new rule
          const newRule: HostRule = {
            hostType,
          };
          if (matchHost) {
            newRule.matchHost = matchHost;
          }
          newRule[suffix] = env[envName] as never; // TODO: fix types (#9610)
          hostRules.push(newRule);
        }
      }
    }
  }
  return hostRules;
}

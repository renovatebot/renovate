import { logger } from '../../../../logger';
import { getDatasourceList } from '../../../../modules/datasource';
import type { HostRule } from '../../../../types';

type AuthField = 'token' | 'username' | 'password';

function isAuthField(x: unknown): x is AuthField {
  return x === 'token' || x === 'username' || x === 'password';
}

export function hostRulesFromEnv(env: NodeJS.ProcessEnv): HostRule[] {
  const datasources = new Set(getDatasourceList());

  const hostRules: HostRule[] = [];

  const npmEnvPrefixes = ['npm_config_', 'npm_lifecycle_', 'npm_package_'];

  for (const envName of Object.keys(env).sort()) {
    if (npmEnvPrefixes.some((prefix) => envName.startsWith(prefix))) {
      logger.trace('Ignoring npm env: ' + envName);
      continue;
    }
    // Double underscore __ is used in place of hyphen -
    const splitEnv = envName.toLowerCase().replace(/__/g, '-').split('_');
    const hostType = splitEnv.shift()!;
    if (datasources.has(hostType)) {
      const suffix = splitEnv.pop()!;
      if (isAuthField(suffix)) {
        let matchHost: string | undefined = undefined;
        const rule: HostRule = {};
        rule[suffix] = env[envName];
        if (splitEnv.length === 0) {
          // host-less rule
        } else if (splitEnv.length === 1) {
          logger.warn({ env: envName }, 'Cannot parse env');
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
          existingRule[suffix] = env[envName];
        } else {
          // Create a new rule
          const newRule: HostRule = {
            hostType,
          };
          if (matchHost) {
            newRule.matchHost = matchHost;
          }
          newRule[suffix] = env[envName];
          hostRules.push(newRule);
        }
      }
    }
  }
  return hostRules;
}

import url from 'node:url';
import is from '@sindresorhus/is';
import ini from 'ini';
import { GlobalConfig } from '../../../config/global';
import type { PackageRule } from '../../../config/types';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { fromBase64 } from '../../../util/string';
import { ensureTrailingSlash, validateUrl } from '../../../util/url';
import { defaultRegistryUrls } from './common';
import type { NpmrcRules } from './types';

let npmrc: Record<string, any> = {};
let npmrcRaw = '';
let packageRules: PackageRule[] = [];

function envReplace(value: any, env = process.env): any {
  // istanbul ignore if
  if (!is.string(value)) {
    return value;
  }

  const ENV_EXPR = regEx(/(\\*)\$\{([^}]+)\}/g);

  return value.replace(ENV_EXPR, (match, _esc, envVarName) => {
    if (env[envVarName] === undefined) {
      logger.warn('Failed to replace env in config: ' + match);
      throw new Error('env-replace');
    }
    return env[envVarName]!;
  });
}

export function getMatchHostFromNpmrcHost(input: string): string {
  if (input.startsWith('//')) {
    const matchHost = input.replace('//', '');
    if (matchHost.includes('/')) {
      return 'https://' + matchHost;
    }
    return matchHost;
  }
  return input;
}

export function convertNpmrcToRules(npmrc: Record<string, any>): NpmrcRules {
  const rules: NpmrcRules = {
    hostRules: [],
    packageRules: [],
  };
  // Generate hostRules
  const hostType = 'npm';
  const hosts: Record<string, HostRule> = {};
  for (const [key, value] of Object.entries(npmrc)) {
    if (!is.nonEmptyString(value)) {
      continue;
    }
    const keyParts = key.split(':');
    const keyType = keyParts.pop();
    let matchHost = '';
    if (keyParts.length) {
      matchHost = getMatchHostFromNpmrcHost(keyParts.join(':'));
    }
    const rule: HostRule = hosts[matchHost] || {};
    if (keyType === '_authToken' || keyType === '_auth') {
      rule.token = value;
      if (keyType === '_auth') {
        rule.authType = 'Basic';
      }
    } else if (keyType === 'username') {
      rule.username = value;
    } else if (keyType === '_password') {
      rule.password = fromBase64(value);
    } else {
      continue; // don't add the rule
    }
    hosts[matchHost] = rule;
  }
  for (const [matchHost, rule] of Object.entries(hosts)) {
    const hostRule = { ...rule, hostType };
    if (matchHost) {
      hostRule.matchHost = matchHost;
    }
    rules.hostRules?.push(hostRule);
  }
  // Generate packageRules
  const matchDatasources = ['npm'];
  const { registry } = npmrc;
  // packageRules order matters, so look for a default registry first
  if (is.nonEmptyString(registry)) {
    if (validateUrl(registry)) {
      // Default registry
      rules.packageRules?.push({
        matchDatasources,
        registryUrls: [registry],
      });
    } else {
      logger.warn({ registry }, 'Invalid npmrc registry= URL');
    }
  }
  // Now look for scoped registries
  for (const [key, value] of Object.entries(npmrc)) {
    if (!is.nonEmptyString(value)) {
      continue;
    }
    const keyParts = key.split(':');
    const keyType = keyParts.pop();
    if (keyType === 'registry' && keyParts.length && is.nonEmptyString(value)) {
      const scope = keyParts.join(':');
      if (validateUrl(value)) {
        rules.packageRules?.push({
          matchDatasources,
          matchPackagePrefixes: [scope + '/'],
          registryUrls: [value],
        });
      } else {
        logger.warn({ scope, registry: value }, 'Invalid npmrc registry= URL');
      }
    }
  }
  return rules;
}

export function setNpmrc(input?: string): void {
  if (input) {
    if (input === npmrcRaw) {
      return;
    }
    const existingNpmrc = npmrc;
    npmrcRaw = input;
    logger.debug('Setting npmrc');
    npmrc = ini.parse(input.replace(regEx(/\\n/g), '\n'));
    const exposeAllEnv = GlobalConfig.get('exposeAllEnv');
    for (const [key, val] of Object.entries(npmrc)) {
      if (
        !exposeAllEnv &&
        key.endsWith('registry') &&
        is.string(val) &&
        val.includes('localhost')
      ) {
        logger.debug(
          { key, val },
          'Detected localhost registry - rejecting npmrc file',
        );
        npmrc = existingNpmrc;
        return;
      }
    }
    if (exposeAllEnv) {
      for (const key of Object.keys(npmrc)) {
        npmrc[key] = envReplace(npmrc[key]);
      }
    }
    const npmrcRules = convertNpmrcToRules(npmrc);
    if (npmrcRules.hostRules?.length) {
      npmrcRules.hostRules.forEach((hostRule) => hostRules.add(hostRule));
    }
    packageRules = npmrcRules.packageRules;
  } else if (npmrc) {
    logger.debug('Resetting npmrc');
    npmrc = {};
    npmrcRaw = '';
    packageRules = [];
  }
}

export function resolveRegistryUrl(packageName: string): string {
  let registryUrl = defaultRegistryUrls[0];
  for (const rule of packageRules) {
    const { matchPackagePrefixes, registryUrls } = rule;
    if (
      !matchPackagePrefixes ||
      packageName.startsWith(matchPackagePrefixes[0])
    ) {
      // TODO: fix types #22198
      registryUrl = registryUrls![0];
    }
  }
  return registryUrl;
}

export function resolvePackageUrl(
  registryUrl: string,
  packageName: string,
): string {
  return url.resolve(
    ensureTrailingSlash(registryUrl),
    encodeURIComponent(packageName).replace(regEx(/^%40/), '@'),
  );
}

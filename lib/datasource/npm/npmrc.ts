import url from 'url';
import is from '@sindresorhus/is';
import ini from 'ini';
import getRegistryUrl from 'registry-auth-token/registry-url.js';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import type { HostRule } from '../../types';
import * as hostRules from '../../util/host-rules';
import { regEx } from '../../util/regex';
import { fromBase64 } from '../../util/string';
import type { Npmrc, NpmrcRules, PackageResolution } from './types';

let npmrc: Record<string, any> = {};
let npmrcRaw = '';

export function getNpmrc(): Npmrc | null {
  return npmrc;
}

function envReplace(value: any, env = process.env): any {
  // istanbul ignore if
  if (!is.string(value)) {
    return value;
  }

  const ENV_EXPR = regEx(/(\\*)\$\{([^}]+)\}/g);

  return value.replace(ENV_EXPR, (match, esc, envVarName) => {
    if (env[envVarName] === undefined) {
      logger.warn('Failed to replace env in config: ' + match);
      throw new Error('env-replace');
    }
    return env[envVarName];
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
  };
  const hostType = 'npm';
  const hosts: Record<string, HostRule> = {};
  for (const [key, value] of Object.entries(npmrc)) {
    if (!is.string(value)) {
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
    rules.hostRules.push(hostRule);
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
    const { exposeAllEnv } = GlobalConfig.get();
    for (const [key, val] of Object.entries(npmrc)) {
      if (
        !exposeAllEnv &&
        key.endsWith('registry') &&
        val &&
        val.includes('localhost')
      ) {
        logger.debug(
          { key, val },
          'Detected localhost registry - rejecting npmrc file'
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
    if (npmrcRules.hostRules.length) {
      npmrcRules.hostRules.forEach((hostRule) => hostRules.add(hostRule));
    }
  } else if (npmrc) {
    logger.debug('Resetting npmrc');
    npmrc = {};
    npmrcRaw = '';
  }
}

export function resolvePackage(packageName: string): PackageResolution {
  const scope = packageName.split('/')[0];
  let registryUrl: string;
  try {
    registryUrl = getRegistryUrl(scope, getNpmrc());
  } catch (err) {
    registryUrl = 'https://registry.npmjs.org/';
  }
  const packageUrl = url.resolve(
    registryUrl,
    encodeURIComponent(packageName).replace(regEx(/^%40/), '@')
  );
  return { packageUrl, registryUrl };
}

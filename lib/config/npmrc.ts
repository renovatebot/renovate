import ini from 'ini';
import { id as hostType } from '../datasource/npm';
import { validateUrl } from '../util/url';
import { RenovateConfig } from './types';

export interface NpmrcConfig {
  defaultRegistry?: string;
  auth?: string;
  authToken?: string;
  scopedRegistries?: Record<string, string>;
  authRegistries?: Record<string, string>;
  authTokenRegistries?: Record<string, string>;
}

export function getConfigFromNpmrc(npmrc = ''): NpmrcConfig {
  const res: NpmrcConfig = {
    scopedRegistries: {},
    authRegistries: {},
    authTokenRegistries: {},
  };
  const parsed = ini.parse(npmrc);
  for (const [key, val] of Object.entries(parsed)) {
    if (key === '_auth') {
      res.auth = val;
    } else if (key === '_authToken') {
      res.authToken = val;
    } else if (key === 'registry') {
      res.defaultRegistry = val;
    } else if (key.endsWith(':_auth')) {
      const registry = key.replace(/:_auth$/, '').replace(/^\/\//, '');
      res.authRegistries[registry] = val;
    } else if (key.endsWith(':_authToken')) {
      const registry = key.replace(/:_authToken$/, '').replace(/^\/\//, '');
      res.authTokenRegistries[registry] = val;
    } else if (key.endsWith(':registry')) {
      if (validateUrl(val, false)) {
        const [scope] = key.split(':');
        res.scopedRegistries[scope] = val;
      }
    }
  }
  return res;
}

export function getConfigRulesFromNpmrc(npmrc = ''): RenovateConfig {
  const config = getConfigFromNpmrc(npmrc);
  const res: RenovateConfig = { hostRules: [], packageRules: [] };
  if (config.defaultRegistry) {
    res.packageRules.push({
      matchDatasources: [hostType],
      registryUrls: [config.defaultRegistry],
    });
  }
  if (config.auth) {
    res.hostRules.push({
      hostType,
      authType: 'Basic',
      token: config.auth,
    });
  }
  if (config.authToken) {
    res.hostRules.push({ hostType, token: config.authToken });
  }
  for (const [matchHost, token] of Object.entries(config.authRegistries)) {
    res.hostRules.push({
      hostType,
      matchHost,
      authType: 'Basic',
      token,
    });
  }
  for (const [matchHost, token] of Object.entries(config.authTokenRegistries)) {
    res.hostRules.push({
      hostType,
      matchHost,
      token,
    });
  }
  for (const [scope, registryUrl] of Object.entries(config.scopedRegistries)) {
    res.packageRules.push({
      matchDatasources: [hostType],
      matchPackagePrefixes: [scope],
      registryUrls: [registryUrl],
    });
  }
  return res;
}

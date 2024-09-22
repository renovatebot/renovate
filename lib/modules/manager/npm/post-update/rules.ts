import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import * as hostRules from '../../../../util/host-rules';
import { regEx } from '../../../../util/regex';
import { toBase64 } from '../../../../util/string';
import { isHttpUrl } from '../../../../util/url';
import type { YarnRcYmlFile } from './types';

export interface HostRulesResult {
  additionalNpmrcContent: string[];
  additionalYarnRcYml?: any;
}

export function processHostRules(): HostRulesResult {
  const additionalYarnRcYml: YarnRcYmlFile = { npmRegistries: {} };

  // Determine the additional npmrc content to add based on host rules
  const additionalNpmrcContent = [];
  const npmHostRules = hostRules.findAll({
    hostType: 'npm',
  });
  logger.debug(`Found ${npmHostRules.length} npm host rule(s)`);
  for (const hostRule of npmHostRules) {
    if (!hostRule.resolvedHost) {
      logger.debug('Skipping host rule without resolved host');
      continue;
    }

    const matchedHost = hostRule.matchHost;
    // Should never be necessary as if we have a resolvedHost, there has to be a matchHost
    // istanbul ignore next
    if (!matchedHost) {
      logger.debug('Skipping host rule without matchHost');
      continue;
    }

    const uri = `//${matchedHost}/`;
    let cleanedUri = uri;
    if (isHttpUrl(matchedHost)) {
      cleanedUri = matchedHost.replace(regEx(/^https?:/), '');
    }

    if (hostRule.token) {
      const key = hostRule.authType === 'Basic' ? '_auth' : '_authToken';
      logger.debug(`Adding npmrc entry for ${cleanedUri} with key ${key}`);
      additionalNpmrcContent.push(`${cleanedUri}:${key}=${hostRule.token}`);

      if (hostRule.authType === 'Basic') {
        const registry = {
          npmAuthIdent: hostRule.token,
        };
        additionalYarnRcYml.npmRegistries[cleanedUri] = registry;
        additionalYarnRcYml.npmRegistries[uri] = registry;

        continue;
      }

      const registry = {
        npmAuthToken: hostRule.token,
      };
      additionalYarnRcYml.npmRegistries[cleanedUri] = registry;
      additionalYarnRcYml.npmRegistries[uri] = registry;

      continue;
    }

    if (is.string(hostRule.username) && is.string(hostRule.password)) {
      logger.debug(
        `Adding npmrc entry for ${cleanedUri} with username/password`,
      );
      const password = toBase64(hostRule.password);
      additionalNpmrcContent.push(
        `${cleanedUri}:username=${hostRule.username}`,
      );
      additionalNpmrcContent.push(`${cleanedUri}:_password=${password}`);

      const registries = {
        npmAuthIdent: `${hostRule.username}:${hostRule.password}`,
      };
      additionalYarnRcYml.npmRegistries[cleanedUri] = registries;
      additionalYarnRcYml.npmRegistries[uri] = registries;
    }
  }

  const hasYarnRcNpmRegistries =
    Object.keys(additionalYarnRcYml.npmRegistries).length > 0;
  return {
    additionalNpmrcContent,
    additionalYarnRcYml: hasYarnRcNpmRegistries
      ? additionalYarnRcYml
      : undefined,
  };
}

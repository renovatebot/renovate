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
  // Include host rules without specific type to mimic the behavior used when determining dependencies with updates.
  const noTypeHostRules = hostRules
    .getAll()
    .filter((rule) => rule.hostType === null || rule.hostType === undefined);
  logger.debug(
    `Found ${noTypeHostRules.length} host rule(s) without host type`,
  );
  // Drop duplicates for the same matchHost while prefering the more specific rules with hostType npm.
  const noTypeHostRulesWithoutDuplicates = noTypeHostRules.filter(
    (rule) => !npmHostRules.some((elem) => elem.matchHost === rule.matchHost),
  );
  logger.debug(
    `Found ${noTypeHostRulesWithoutDuplicates.length} host rule(s) without host type after dropping duplicates`,
  );
  const effectiveHostRules = npmHostRules.concat(
    noTypeHostRulesWithoutDuplicates,
  );
  logger.trace(
    `Found ${effectiveHostRules.length} effective npm host rule(s) after deduplication`,
  );
  for (const hostRule of effectiveHostRules) {
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

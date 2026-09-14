import { logger } from '../../../../logger/index.ts';
import * as hostRules from '../../../../util/host-rules.ts';
import { regEx } from '../../../../util/regex.ts';
import { toBase64 } from '../../../../util/string.ts';
import { isHttpUrl } from '../../../../util/url.ts';
import type { HostRulesResult, YarnRcYmlFile } from './types.ts';
export function processHostRules(): HostRulesResult {
  const additionalYarnRcYml: YarnRcYmlFile = { npmRegistries: {} };

  // Determine the additional npmrc content to add based on host rules
  const additionalNpmrcContent = [];
  const effectiveHostRules = hostRules.findAllForHostType('npm');
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
    /* v8 ignore if -- unreachable: a resolvedHost implies matchHost is set (see comment above) */
    if (!matchedHost) {
      logger.debug('Skipping host rule without matchHost');
      continue;
    }

    const uri = `//${matchedHost}/`;
    let cleanedUri = uri;
    if (isHttpUrl(matchedHost)) {
      cleanedUri = matchedHost.replace(regEx(/^https?:/), '');
    }

    const auth = hostRules.resolveAuth(hostRule);
    // v8 ignore if -- TODO: add test #40625
    if (!auth) {
      continue;
    }

    if (auth.type === 'token') {
      const key = auth.authType === 'Basic' ? '_auth' : '_authToken';
      logger.debug(`Adding npmrc entry for ${cleanedUri} with key ${key}`);
      additionalNpmrcContent.push(`${cleanedUri}:${key}=${auth.token}`);

      if (auth.authType === 'Basic') {
        const registry = {
          npmAuthIdent: auth.token,
        };
        additionalYarnRcYml.npmRegistries[cleanedUri] = registry;
        additionalYarnRcYml.npmRegistries[uri] = registry;

        continue;
      }

      const registry = {
        npmAuthToken: auth.token,
      };
      additionalYarnRcYml.npmRegistries[cleanedUri] = registry;
      additionalYarnRcYml.npmRegistries[uri] = registry;

      continue;
    }

    logger.debug(`Adding npmrc entry for ${cleanedUri} with username/password`);
    const username = auth.username ?? '';
    const password = toBase64(auth.password);
    additionalNpmrcContent.push(`${cleanedUri}:username=${username}`);
    additionalNpmrcContent.push(`${cleanedUri}:_password=${password}`);

    const registries = {
      npmAuthIdent: hostRules.basicUserinfo(auth),
    };
    additionalYarnRcYml.npmRegistries[cleanedUri] = registries;
    additionalYarnRcYml.npmRegistries[uri] = registries;
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

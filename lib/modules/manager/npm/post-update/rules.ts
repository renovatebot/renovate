import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import * as hostRules from '../../../../util/host-rules';
import { regEx } from '../../../../util/regex';
import { toBase64 } from '../../../../util/string';
import { isHttpUrl } from '../../../../util/url';

export interface HostRulesResult {
  additionalNpmrcContent: string[];
  additionalYarnRcYml?: any;
}

export function processHostRules(): HostRulesResult {
  let additionalYarnRcYml: any;

  // Determine the additional npmrc content to add based on host rules
  const additionalNpmrcContent = [];
  const npmHostRules = hostRules.findAll({
    hostType: 'npm',
  });
  logger.debug(`Found ${npmHostRules.length} npm host rule(s)`);
  for (const hostRule of npmHostRules) {
    if (hostRule.resolvedHost) {
      let uri = hostRule.matchHost;
      uri =
        is.string(uri) && isHttpUrl(uri)
          ? uri.replace(regEx(/^https?:/), '')
          : // TODO: types (#22198)
            `//${uri}/`;
      if (hostRule.token) {
        const key = hostRule.authType === 'Basic' ? '_auth' : '_authToken';
        logger.debug(`Adding npmrc entry for ${uri}:${key}`);
        additionalNpmrcContent.push(`${uri}:${key}=${hostRule.token}`);
        additionalYarnRcYml ||= { npmRegistries: {} };
        if (hostRule.authType === 'Basic') {
          additionalYarnRcYml.npmRegistries[uri] = {
            npmAuthIdent: hostRule.token,
          };
        } else {
          additionalYarnRcYml.npmRegistries[uri] = {
            npmAuthToken: hostRule.token,
          };
        }
      } else if (is.string(hostRule.username) && is.string(hostRule.password)) {
        logger.debug(`Adding npmrc entry for ${uri}:username and _password`);
        const password = toBase64(hostRule.password);
        additionalNpmrcContent.push(`${uri}:username=${hostRule.username}`);
        additionalNpmrcContent.push(`${uri}:_password=${password}`);
        additionalYarnRcYml ||= { npmRegistries: {} };
        additionalYarnRcYml.npmRegistries[uri] = {
          npmAuthIdent: `${hostRule.username}:${hostRule.password}`,
        };
      } else {
        logger.debug(
          `Skipping host rule with no token or username/password for ${hostRule.matchHost}`,
        );
      }
    } else {
      logger.debug(`Skipping host rule with no resolved host`);
    }
  }
  return { additionalNpmrcContent, additionalYarnRcYml };
}

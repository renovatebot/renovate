import is from '@sindresorhus/is';
import * as hostRules from '../../../util/host-rules';
import { validateUrl } from '../../../util/url';

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
  for (const hostRule of npmHostRules) {
    if (hostRule.resolvedHost) {
      let uri = hostRule.matchHost;
      uri = validateUrl(uri) ? uri.replace(/^https?:/, '') : `//${uri}/`;
      if (hostRule.token) {
        const key = hostRule.authType === 'Basic' ? '_auth' : '_authToken';
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
        const password = Buffer.from(hostRule.password).toString('base64');
        additionalNpmrcContent.push(`${uri}:username=${hostRule.username}`);
        additionalNpmrcContent.push(`${uri}:_password=${password}`);
        additionalYarnRcYml ||= { npmRegistries: {} };
        additionalYarnRcYml.npmRegistries[uri] = {
          npmAuthIdent: Buffer.from(
            `${hostRule.username}:${hostRule.password}`
          ).toString('base64'),
        };
      }
    }
  }
  return { additionalNpmrcContent, additionalYarnRcYml };
}

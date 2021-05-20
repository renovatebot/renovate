import { logger } from '../../logger';
import { hasProxy } from '../../proxy';
import * as hostRules from '../host-rules';
import { GotOptions } from './types';

// Apply host rules to requests

export function applyHostRules(url: string, inOptions: GotOptions): GotOptions {
  const options = { ...inOptions };
  const foundRules =
    hostRules.find({
      hostType: options.hostType,
      url,
    }) || /* istanbul ignore next: can only happen in tests */ {};
  const { username, password, token, enabled, authType } = foundRules;
  if (options.headers?.authorization || options.password || options.token) {
    logger.trace({ url }, `Authorization already set`);
  } else if (password !== undefined) {
    logger.trace({ url }, `Applying Basic authentication`);
    options.username = username;
    options.password = password;
  } else if (token) {
    logger.trace({ url }, `Applying Bearer authentication`);
    options.token = token;
    options.context = { ...options.context, authType };
  } else if (enabled === false) {
    options.enabled = false;
  }
  // Apply optional params
  ['abortOnError', 'abortIgnoreStatusCodes', 'timeout'].forEach((param) => {
    if (foundRules[param]) {
      options[param] = foundRules[param];
    }
  });

  if (!hasProxy() && foundRules.enableHttp2 === true) {
    options.http2 = true;
  }
  return options;
}

export function getRequestLimit(url: string): number | null {
  const hostRule = hostRules.find({
    url,
  });
  const limit = hostRule.concurrentRequestLimit;
  return typeof limit === 'number' && limit > 0 ? limit : null;
}

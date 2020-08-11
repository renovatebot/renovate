import { logger } from '../../logger';
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
  const { username, password, token, enabled } = foundRules;
  if (options.headers?.authorization || options.password || options.token) {
    logger.trace(`Authorization already set for host:  ${options.hostname}`);
  } else if (password) {
    logger.trace(`Applying Basic authentication for host ${options.hostname}`);
    options.username = username;
    options.password = password;
  } else if (token) {
    logger.trace(`Applying Bearer authentication for host ${options.hostname}`);
    options.token = token;
  } else if (enabled === false) {
    options.enabled = false;
  }
  // Apply optional params
  ['abortOnError', 'abortIgnoreStatusCodes', 'timeout'].forEach((param) => {
    if (foundRules[param]) {
      options[param] = foundRules[param];
    }
  });
  return options;
}

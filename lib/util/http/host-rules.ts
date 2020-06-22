import { logger } from '../../logger';
import * as hostRules from '../host-rules';

// Apply host rules to requests

export function applyHostRules(url: string, inOptions: any): any {
  const options = { ...inOptions };
  const foundRules =
    hostRules.find({
      hostType: options.hostType,
      url,
    }) || {};
  const { username, password, token, timeout } = foundRules;
  if (options.headers?.authorization || options.auth || options.token) {
    logger.trace('Authorization already set for host: ' + options.hostname);
  } else if (password) {
    logger.trace('Applying Basic authentication for host ' + options.hostname);
    options.auth = `${username || ''}:${password}`;
  } else if (token) {
    logger.trace('Applying Bearer authentication for host ' + options.hostname);
    options.token = token;
  }
  if (timeout) {
    options.timeout = timeout;
  }
  return options;
}

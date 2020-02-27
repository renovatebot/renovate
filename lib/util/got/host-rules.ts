/* eslint-disable no-param-reassign */
import got, { InitHook } from 'got';
import { parse } from 'url';
import { logger } from '../../logger';
import * as hostRules from '../host-rules';
import { RenovateGotInitOptions } from './types';

// Apply host rules to requests

const hook: InitHook = (options: RenovateGotInitOptions) => {
  const uri = parse(options.url.toString());
  if (!uri.hostname) {
    return;
  }
  const { username, password, token, timeout } = hostRules.find({
    hostType: options.context?.hostType,
    url: options.url.toString(),
  });
  if (
    options.headers?.authorization ||
    options.username ||
    options.context?.token
  ) {
    logger.trace('Authorization already set for host: ' + uri.hostname);
  } else if (password) {
    logger.trace('Applying Basic authentication for host ' + uri.hostname);
    options.username = username;
    options.password = password;
  } else if (token) {
    logger.trace('Applying Bearer authentication for host ' + uri.hostname);
    options.context = { ...options.context, token };
  }
  if (timeout) {
    options.timeout = { request: timeout };
  }
};

// istanbul ignore next
export default got.extend({
  hooks: {
    init: [hook],
  },
});

import got, { InitHook } from 'got';
import { parse } from 'url';
import { logger } from '../../logger';
import {
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import { RenovateGotExtendOptions } from './types';

const hook: InitHook = (options: RenovateGotExtendOptions) => {
  const uri = parse(options.url.toString());
  if (options.username || options.headers?.authorization) {
    return;
  }
  if (options.context?.token) {
    logger.trace({ hostname: uri.hostname }, 'Converting token to Bearer auth');
    if (!options.headers) options.headers = {}; // eslint-disable-line no-param-reassign
    if (
      options.context?.hostType === PLATFORM_TYPE_GITHUB ||
      options.context?.hostType === PLATFORM_TYPE_GITEA
    ) {
      options.headers.authorization = `token ${options.context.token}`; // eslint-disable-line no-param-reassign
    } else if (options.context.hostType === PLATFORM_TYPE_GITLAB) {
      options.headers['Private-token'] = options.context?.token; // eslint-disable-line no-param-reassign
    } else {
      options.headers.authorization = `Bearer ${options.context.token}`; // eslint-disable-line no-param-reassign
    }
    delete options.context?.token; // eslint-disable-line no-param-reassign
  }
};

// istanbul ignore next
export default got.extend({
  hooks: { init: [hook] },
});

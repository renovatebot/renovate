import cacheGet from './cache-get';
import renovateAgent from './renovate-agent';
import hostRules from './host-rules';
import auth from './auth';
import { instance } from './stats';
import { mergeInstances } from './util';

export * from './common';

/*
 * This is the default got instance for Renovate.
 *  - Set the user agent to be Renovate
 *  - Cache all GET requests for the lifetime of the repo
 *
 * Important: always put the renovateAgent one last, to make sure the correct user agent is used
 */
export const api = mergeInstances(
  cacheGet,
  renovateAgent,
  hostRules,
  auth,
  instance
);

export default api;

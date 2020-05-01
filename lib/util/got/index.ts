import auth from './auth';
import cacheGet from './cache-get';
import hostRules from './host-rules';
import renovateAgent from './renovate-agent';
import { mergeInstances } from './util';

export * from './common';

/*
 * This is the default got instance for Renovate.
 *  - Set the user agent to be Renovate
 *  - Cache all GET requests for the lifetime of the repo
 *
 */
export const api = mergeInstances(cacheGet, renovateAgent, hostRules, auth);

export default api;

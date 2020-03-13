import cacheGet from './cache-get';
import renovateAgent from './renovate-agent';
import hostRules from './host-rules';
import auth from './auth';
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

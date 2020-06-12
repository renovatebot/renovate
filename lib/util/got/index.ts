import got from 'got';
import auth from './auth';
import hostRules from './host-rules';
import { mergeInstances } from './util';

export * from './common';

/*
 * This is the default got instance for Renovate.
 *  - Cache all GET requests for the lifetime of the repo
 *
 */
export const api = mergeInstances(got, hostRules, auth);

export default api;

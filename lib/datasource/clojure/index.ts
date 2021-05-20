import { MAVEN_REPO } from '../maven/common';

export const id = 'clojure';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://clojars.org/repo', MAVEN_REPO];
export const registryStrategy = 'merge';

export { getReleases } from '../maven';

import { MAVEN_REPO } from '../maven/common';

export const id = 'clojure';

export const defaultRegistryUrls = ['https://clojars.org/repo', MAVEN_REPO];

export { getReleases } from '../maven';

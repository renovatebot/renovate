import { parseUrl } from '../../../util/url.ts';
export const id = 'maven';

export const MAVEN_REPO = 'https://repo.maven.apache.org/maven2';
export const MAVEN_CENTRAL_MIRROR = 'https://repo1.maven.org/maven2';
export const MAVEN_CENTRAL_URLS = [MAVEN_REPO, MAVEN_CENTRAL_MIRROR];

function getHost(url: string): string | undefined {
  return parseUrl(url)?.host;
}

export function isMavenCentral(url: string): boolean {
  return MAVEN_CENTRAL_URLS.some(
    (mavenRepo) => getHost(url) === getHost(mavenRepo),
  );
}

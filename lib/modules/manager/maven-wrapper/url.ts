import { parseUrl } from '../../../util/url.ts';

export function isPublicArtifactUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  if (
    parsed.origin !== 'https://repo.maven.apache.org' &&
    parsed.origin !== 'https://repo1.maven.org'
  ) {
    return false;
  }

  if (!parsed.pathname.startsWith('/maven2/')) {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  if (parsed.href.includes('?') || parsed.href.includes('#')) {
    return false;
  }

  return true;
}

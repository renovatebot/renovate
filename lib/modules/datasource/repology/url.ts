import { joinUrlParts, parseUrl } from '../../../util/url.ts';

export function isPublicRegistry(registryUrl: string): boolean {
  const url = parseUrl(joinUrlParts(registryUrl, 'tools/project-by'));
  if (!url) {
    return false;
  }

  if (url.origin !== 'https://repology.org') {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  if (url.search || url.hash) {
    return false;
  }

  if (url.pathname !== '/tools/project-by') {
    return false;
  }

  return true;
}

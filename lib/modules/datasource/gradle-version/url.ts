import { parseUrl } from '../../../util/url.ts';

export const publicRegistryUrl = 'https://services.gradle.org/versions/all';

export function isPublicRegistry(registryUrl: string | undefined): boolean {
  const url = parseUrl(registryUrl);
  if (!url) {
    return false;
  }

  if (`${url.origin}${url.pathname}` !== publicRegistryUrl) {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  if (url.search || url.hash) {
    return false;
  }

  return true;
}

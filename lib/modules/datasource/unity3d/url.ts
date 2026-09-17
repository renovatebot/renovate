import { parseUrl } from '../../../util/url.ts';

export function isPublicPageUrl(pageUrl: string): boolean {
  const url = parseUrl(pageUrl);
  if (!url) {
    return false;
  }

  if (url.origin !== 'https://services.api.unity.com') {
    return false;
  }

  if (url.username || url.password || url.hash) {
    return false;
  }

  if (url.pathname !== '/unity/editor/release/v1/releases') {
    return false;
  }

  const publicParameters = [
    'limit',
    'offset',
    'order',
    'stream',
    'platform',
    'architecture',
    'version',
  ];
  return [...url.searchParams.keys()].every((key) =>
    publicParameters.includes(key),
  );
}

import { regEx } from '../../../util/regex.ts';
import { joinUrlParts } from '../../../util/url.ts';

export const defaultRegistryUrl = 'https://gitlab.com';

export function getDepHost(registryUrl: string = defaultRegistryUrl): string {
  return registryUrl.replace(regEx(/\/api\/v4$/), '');
}

export function getSourceUrl(
  packageName: string,
  registryUrl?: string,
): string {
  const depHost = getDepHost(registryUrl);
  return joinUrlParts(depHost, packageName);
}

// import { GlobalConfig } from '../../../config/global';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';

export const defaultRegistryUrl = 'https://gitlab.com';

export function getDepHost(registryUrl: string = defaultRegistryUrl): string {
  return registryUrl.replace(regEx(/\/api\/v4$/), '');
}

export function getDefaultRegistryUrl(): string[] {
  return [defaultRegistryUrl];
  // const { platform, endpoint } = GlobalConfig.get();
  // return platform === 'gitlab' && endpoint ? [endpoint] : [defaultRegistryUrl];
}

export function getSourceUrl(
  packageName: string,
  registryUrl?: string
): string {
  const depHost = getDepHost(registryUrl);
  return joinUrlParts(depHost, packageName);
}

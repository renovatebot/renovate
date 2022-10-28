import type { ConanPackage } from './types';

export const defaultRegistryUrl = 'https://center.conan.io/';

export const datasource = 'conan';

export function getConanPackage(packageName: string): ConanPackage {
  const depName = packageName.split('/')[0];
  const userAndChannel = packageName.split('@')[1];
  return { depName, userAndChannel };
}

import { regEx } from '../../../util/regex';
import type { ConanPackage } from './types';

export const defaultRegistryUrl = 'https://center.conan.io/';

export const datasource = 'conan';

export const conanDatasourceRegex = regEx(
  /(?<name>[a-z\-_0-9]+)\/(?<version>[^@/\n]+)(?<userChannel>@\S+\/\S+)/gim,
);

export function getConanPackage(packageName: string): ConanPackage {
  const conanName = packageName.split('/')[0];
  const userAndChannel = packageName.split('@')[1];
  return { conanName, userAndChannel };
}

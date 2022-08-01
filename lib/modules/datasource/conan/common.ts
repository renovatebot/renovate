import { regEx } from '../../../util/regex';

export const defaultRegistryUrl = 'https://center.conan.io/';

export const datasource = 'conan';

export const conanDatasourceRegex = regEx(
  /(?<name>[a-z\-_0-9]+)\/(?<version>[^@/\n]+)(?<userChannel>@\S+\/\S+)/,
  'gim'
);

export function getRevision(packageName: string): string | undefined {
  const splitted = packageName.split('#');
  if (splitted.length <= 1) {
    return undefined;
  } else {
    return splitted[1];
  }
}

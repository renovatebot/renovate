import { regEx } from '../../util/regex';

export const defaultRegistryUrl = 'https://center.conan.io/';

export const datasource = 'conan';

export const conanDatasourceRegex = regEx(
  /(?<name>[a-z\-_0-9]+)\/(?<version>[^@/\n]+)(?<userChannel>@\S+\/\S+)/,
  'gim'
);

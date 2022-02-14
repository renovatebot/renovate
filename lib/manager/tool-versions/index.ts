import * as GitHubTagsDatasource from '../../datasource/github-tags';
import * as NpmDatasource from '../../datasource/npm';
import { RubyVersionDatasource } from '../../datasource/ruby-version';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)\\.tool-versions$'],
};

export const supportedDatasources = [
  GitHubTagsDatasource.id,
  NpmDatasource.id,
  RubyVersionDatasource.id,
];

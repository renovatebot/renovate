import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { RubyVersionDatasource } from '../../datasource/ruby-version';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)\\.tool-versions$'],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitRefsDatasource.id,
  RubyVersionDatasource.id,
];

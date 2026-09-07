import type { Category } from '../../../constants/index.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { ClojureDatasource } from '../../datasource/clojure/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import * as mavenVersioning from '../../versioning/maven/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const displayName = 'deps.edn';
export const url = 'https://clojure.org/reference/deps_edn';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)(?:deps|bb)\\.edn$/'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [
  BitbucketTagsDatasource.id,
  ClojureDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  GitRefsDatasource.id,
];

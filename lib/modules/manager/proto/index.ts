import { deduplicateArray } from '../../../util/array.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'proto';
export const url = 'https://moonrepo.dev/proto';

export const defaultConfig = {
  managerFilePatterns: ['**/.prototools'],
};

export const supportedDatasources = deduplicateArray([
  GithubReleasesDatasource.id,
  GithubTagsDatasource.id,
  NodeVersionDatasource.id,
  NpmDatasource.id,
  RubyVersionDatasource.id,
]).sort();

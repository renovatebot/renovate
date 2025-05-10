import { deduplicateArray } from '../../../util/array';
import { CrateDatasource } from '../../datasource/crate';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GoDatasource } from '../../datasource/go';
import { JavaVersionDatasource } from '../../datasource/java-version';
import { NodeVersionDatasource } from '../../datasource/node-version';
import { NpmDatasource } from '../../datasource/npm';
import { NugetDatasource } from '../../datasource/nuget';
import { PypiDatasource } from '../../datasource/pypi';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import { RubygemsDatasource } from '../../datasource/rubygems';
import { supportedDatasources as asdfSupportedDatasources } from '../asdf';

export { extractPackageFile } from './extract';

export const displayName = 'mise-en-place';
export const url = 'https://mise.jdx.dev';

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)\\.?mise\\.toml$/',
    '/(^|/)\\.?mise/config\\.toml$/',
  ],
};

const backendDatasources = {
  core: [
    GithubReleasesDatasource.id,
    GithubTagsDatasource.id,
    JavaVersionDatasource.id,
    NodeVersionDatasource.id,
    RubyVersionDatasource.id,
  ],
  // Re-use the asdf datasources, as mise and asdf support the same plugins.
  asdf: asdfSupportedDatasources,
  aqua: [GithubTagsDatasource.id],
  cargo: [CrateDatasource.id, GitTagsDatasource.id, GitRefsDatasource.id],
  dotnet: [NugetDatasource.id],
  gem: [RubygemsDatasource.id],
  go: [GoDatasource.id],
  npm: [NpmDatasource.id],
  pipx: [PypiDatasource.id, GithubTagsDatasource.id, GitRefsDatasource.id],
  spm: [GithubReleasesDatasource.id],
  ubi: [GithubReleasesDatasource.id],
  // not supported
  vfox: [],
};

export const supportedDatasources = deduplicateArray(
  Object.values(backendDatasources).flat(),
).sort();

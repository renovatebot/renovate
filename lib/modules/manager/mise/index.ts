import { deduplicateArray } from '../../../util/array.ts';
import { CrateDatasource } from '../../datasource/crate/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { JavaVersionDatasource } from '../../datasource/java-version/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import { RubygemsDatasource } from '../../datasource/rubygems/index.ts';
import { supportedDatasources as asdfSupportedDatasources } from '../asdf/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'mise-en-place';
export const url = 'https://mise.jdx.dev';

export const defaultConfig = {
  managerFilePatterns: [
    '**/{,.}mise{,.*}.toml',
    '**/{,.}mise/config{,.*}.toml',
    '**/.config/mise{,.*}.toml',
    '**/.config/mise/{mise,config}{,.*}.toml',
    '**/.config/mise/conf.d/*.toml',
    '**/.rtx{,.*}.toml',
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
  github: [GithubReleasesDatasource.id],
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

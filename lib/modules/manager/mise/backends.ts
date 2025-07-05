import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { CrateDatasource } from '../../datasource/crate';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GoDatasource } from '../../datasource/go';
import { NpmDatasource } from '../../datasource/npm';
import { NugetDatasource } from '../../datasource/nuget';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import { RubygemsDatasource } from '../../datasource/rubygems';
import type { PackageDependency } from '../types';
import type { MiseToolOptionsSchema } from './schema';

export type BackendToolingConfig = Omit<PackageDependency, 'depName'> &
  Required<
    | Pick<PackageDependency, 'packageName' | 'datasource'>
    | Pick<PackageDependency, 'packageName' | 'skipReason'>
  >;

/**
 * Create a tooling config for aqua backend
 * @link https://mise.jdx.dev/dev-tools/backends/aqua.html
 */
export function createAquaToolConfig(
  name: string,
  version: string,
): BackendToolingConfig {
  // mise supports http aqua package type but we cannot determine it from the tool name
  // An error will be thrown afterwards if the package type is http
  // ref: https://github.com/jdx/mise/blob/d1b9749d8f3e13ef705c1ea471d96c5935b79136/src/aqua/aqua_registry.rs#L39-L45
  return {
    packageName: name,
    datasource: GithubTagsDatasource.id,
    // Trim the leading 'v' from both the current and extracted version
    currentValue: version.replace(regEx(/^v/), ''),
    extractVersion: '^v?(?<version>.+)',
  };
}

const cargoGitVersionRegex = regEx(/^(?<type>tag|branch|rev):(?<version>.+)$/);

/**
 * Create a tooling config for cargo backend
 * @link https://mise.jdx.dev/dev-tools/backends/cargo.html
 */
export function createCargoToolConfig(
  name: string,
  version: string,
): BackendToolingConfig {
  if (!is.urlString(name)) {
    return {
      packageName: name as string, // `is.urlString` type issue
      datasource: CrateDatasource.id,
    };
  }
  // tag: branch: or rev: is required for git repository url
  // e.g. branch:main, tag:0.1.0, rev:abcdef
  const matchGroups = cargoGitVersionRegex.exec(version)?.groups;
  if (is.undefined(matchGroups)) {
    return {
      packageName: name,
      skipReason: 'invalid-version',
    };
  }
  const { type, version: gitVersion } = matchGroups;
  switch (type as 'tag' | 'branch' | 'rev') {
    case 'tag':
      return {
        packageName: name,
        datasource: GitTagsDatasource.id,
        currentValue: gitVersion,
      };
    case 'branch':
      return {
        packageName: name,
        datasource: GitRefsDatasource.id,
        currentValue: gitVersion,
      };
    case 'rev':
      return {
        packageName: name,
        datasource: GitRefsDatasource.id,
        currentValue: gitVersion,
      };
  }
}

/**
 * Create a tooling config for dotnet backend
 * @link https://mise.jdx.dev/dev-tools/backends/dotnet.html
 */
export function createDotnetToolConfig(name: string): BackendToolingConfig {
  return {
    packageName: name,
    datasource: NugetDatasource.id,
  };
}

/**
 * Create a tooling config for gem backend
 * @link https://mise.jdx.dev/dev-tools/backends/gem.html
 */
export function createGemToolConfig(name: string): BackendToolingConfig {
  return {
    packageName: name,
    datasource: RubygemsDatasource.id,
  };
}

/**
 * Create a tooling config for go backend
 * @link https://mise.jdx.dev/dev-tools/backends/go.html
 */
export function createGoToolConfig(name: string): BackendToolingConfig {
  return {
    packageName: name,
    datasource: GoDatasource.id,
  };
}

/**
 * Create a tooling config for npm backend
 * @link https://mise.jdx.dev/dev-tools/backends/npm.html
 */
export function createNpmToolConfig(name: string): BackendToolingConfig {
  return {
    packageName: name,
    datasource: NpmDatasource.id,
  };
}

const pipxGitHubRegex = regEx(/^git\+https:\/\/github\.com\/(?<repo>.+)\.git$/);

/**
 * Create a tooling config for pipx backend
 * @link https://mise.jdx.dev/dev-tools/backends/pipx.html
 */
export function createPipxToolConfig(name: string): BackendToolingConfig {
  const isGitSyntax = name.startsWith('git+');
  // Does not support zip file url
  // Avoid type narrowing to prevent type error
  if (!isGitSyntax && (is.urlString as (value: unknown) => boolean)(name)) {
    return {
      packageName: name,
      skipReason: 'unsupported-url',
    };
  }
  if (isGitSyntax || name.includes('/')) {
    let repoName: string | undefined;
    if (isGitSyntax) {
      repoName = pipxGitHubRegex.exec(name)?.groups?.repo;
      // If the url is not a github repo, treat the version as a git ref
      if (is.undefined(repoName)) {
        return {
          packageName: name.replace(/^git\+/g, '').replaceAll(/\.git$/g, ''),
          datasource: GitRefsDatasource.id,
        };
      }
    } else {
      repoName = name;
    }
    return {
      packageName: repoName,
      datasource: GithubTagsDatasource.id,
    };
  }
  return {
    packageName: normalizePythonDepName(name),
    datasource: PypiDatasource.id,
  };
}

const spmGitHubRegex = regEx(/^https:\/\/github.com\/(?<repo>.+).git$/);

/**
 * Create a tooling config for spm backend
 * @link https://mise.jdx.dev/dev-tools/backends/spm.html
 */
export function createSpmToolConfig(name: string): BackendToolingConfig {
  let repoName: string | undefined;
  // Avoid type narrowing to prevent type error
  if ((is.urlString as (value: unknown) => boolean)(name)) {
    repoName = spmGitHubRegex.exec(name)?.groups?.repo;
    // spm backend only supports github repos
    if (!repoName) {
      return {
        packageName: name,
        skipReason: 'unsupported-url',
      };
    }
  }
  return {
    packageName: repoName ?? name,
    datasource: GithubReleasesDatasource.id,
  };
}

/**
 * Create a tooling config for ubi backend
 * @link https://mise.jdx.dev/dev-tools/backends/ubi.html
 */
export function createUbiToolConfig(
  name: string,
  version: string,
  toolOptions: MiseToolOptionsSchema,
): BackendToolingConfig {
  let extractVersion: string | undefined = undefined;

  const hasVPrefix = version.startsWith('v');
  const setsTagRegex = !hasVPrefix || is.string(toolOptions.tag_regex);

  if (setsTagRegex) {
    // By default, use a regex that matches any tag
    let tagRegex = '.+';
    // Filter versions by tag_regex if it is specified
    // ref: https://mise.jdx.dev/dev-tools/backends/ubi.html#ubi-uses-weird-versions
    if (is.string(toolOptions.tag_regex)) {
      // Remove the leading '^' if it exists to avoid duplication
      tagRegex = toolOptions.tag_regex.replace(/^\^/, '');
      if (!hasVPrefix) {
        // Remove the leading 'v?' if it exists to avoid duplication
        tagRegex = tagRegex.replace(/^v\??/, '');
      }
    }

    // Trim the 'v' prefix if the current version does not have it
    extractVersion = `^${hasVPrefix ? '' : 'v?'}(?<version>${tagRegex})`;
  }

  return {
    packageName: name,
    datasource: GithubReleasesDatasource.id,
    currentValue: version,
    ...(is.string(extractVersion) ? { extractVersion } : {}),
  };
}

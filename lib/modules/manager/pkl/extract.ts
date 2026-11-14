import { isTruthy } from '@sindresorhus/is';
import stripJsonComments from 'strip-json-comments';
import { detectPlatform } from '../../../util/common.ts';
import { regEx } from '../../../util/regex.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { id as semverVersioning } from '../../versioning/semver/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

// `amends`/`extends`/`import`/`import*` clauses and `import(...)`/`import*(...)` expressions
const packageUriRegex = regEx(
  /\b(?:amends|extends|import\*?)\s*\(?\s*"(?<uri>package:\/\/[^"]+)"/g,
);

const githubReleaseRegex = regEx(
  /^(?<host>[^/]+)\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/releases\/download\/(?<tag>[^/]+)\/(?<name>[^/]+)$/,
);

// pkg.pkl-lang.org redirects to the GitHub release tagged `<name>@<version>`
const registryGithubRegex = regEx(
  /^pkg\.pkl-lang\.org\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/(?<name>[^/]+)$/,
);

// every project served under a bare registry path is an `apple/<project>` repository
const registryBareRegex = regEx(
  /^pkg\.pkl-lang\.org\/(?<project>[^/]+)\/(?<name>[^/]+)$/,
);

interface Release {
  name: string;
  packageName: string;
  registryUrls?: string[];
  tag: string;
}

// GitHub Enterprise Server serves release assets on the same path as github.com
function githubServer(host: string): Pick<Release, 'registryUrls'> | null {
  if (host === 'github.com') {
    return {};
  }
  const url = `https://${host}`;
  if (detectPlatform(url) !== 'github') {
    return null;
  }
  return { registryUrls: [url] };
}

function resolveRelease(path: string, version: string): Release | null {
  const github = githubReleaseRegex.exec(path)?.groups;
  const server = github ? githubServer(github.host) : null;
  if (github && server) {
    const { owner, repo, tag, name } = github;
    return { name, packageName: `${owner}/${repo}`, ...server, tag };
  }

  const registryGithub = registryGithubRegex.exec(path)?.groups;
  if (registryGithub) {
    const { owner, repo, name } = registryGithub;
    return { name, packageName: `${owner}/${repo}`, tag: `${name}@${version}` };
  }

  const registryBare = registryBareRegex.exec(path)?.groups;
  // `github.com` is the registry's prefix for GitHub repositories, not a project
  if (registryBare && registryBare.project !== 'github.com') {
    const { project, name } = registryBare;
    return {
      name,
      packageName: `apple/${project}`,
      tag: `${name}@${version}`,
    };
  }

  return null;
}

function extractVersionFor(tag: string, version: string): string {
  const index = tag.indexOf(version);
  const prefix = RegExp.escape(tag.slice(0, index));
  const suffix = RegExp.escape(tag.slice(index + version.length));
  return `^${prefix}(?<version>.+)${suffix}$`;
}

// 'package://' <host> <path> '@' <semver> ['::sha256:' <checksum>] '#' <asset path>
function toDependency(uri: string): PackageDependency | null {
  const withoutFragment = uri.slice('package://'.length).split('#')[0];
  const [coordinates, checksum] = withoutFragment.split('::');
  const at = coordinates.lastIndexOf('@');
  if (at === -1) {
    return null;
  }
  const path = coordinates.slice(0, at);
  const version = coordinates.slice(at + 1);

  const release = resolveRelease(path, version);
  if (!release) {
    return {
      depName: path,
      currentValue: version,
      skipReason: 'unsupported-url',
    };
  }

  const { name, packageName, registryUrls, tag } = release;
  // a new version invalidates the pinned checksum, which cannot be recomputed here
  if (checksum) {
    return { depName: name, currentValue: version, skipReason: 'unsupported' };
  }
  if (!tag.includes(version)) {
    return {
      depName: name,
      currentValue: version,
      skipReason: 'unsupported-version',
    };
  }

  return {
    datasource: GithubReleasesDatasource.id,
    versioning: semverVersioning,
    depName: name,
    packageName,
    ...(registryUrls && { registryUrls }),
    currentValue: version,
    extractVersion: extractVersionFor(tag, version),
    replaceString: uri,
  };
}

export function extractPackageFile(content: string): PackageFileContent | null {
  // Pkl shares the `//` and `/* */` comment syntax and the `"` string quoting of JSONC
  const code = stripJsonComments(content);
  const deps = [...code.matchAll(packageUriRegex)]
    .map((match) => toDependency(match.groups!.uri))
    .filter(isTruthy);
  if (deps.length === 0) {
    return null;
  }
  return { deps };
}

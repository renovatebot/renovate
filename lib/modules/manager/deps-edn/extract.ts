import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { ClojureDatasource } from '../../datasource/clojure';
import { CLOJARS_REPO } from '../../datasource/clojure/common';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { MAVEN_REPO } from '../../datasource/maven/common';
import type { PackageDependency, PackageFileContent } from '../types';
import { parseDepsEdnFile } from './parser';
import type {
  ParsedEdnData,
  ParsedEdnMetadata,
  ParsedEdnRecord,
} from './types';

const dependencyRegex = regEx(
  /^(?<groupId>[a-zA-Z][-_a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-_a-zA-Z0-9]*)*)(?:\/(?<artifactId>[a-zA-Z][-_a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-_a-zA-Z0-9]*)*))?$/,
);

function getPackageName(depName: string): string | null {
  const matchGroups = dependencyRegex.exec(depName)?.groups;
  if (matchGroups) {
    const groupId = matchGroups.groupId;
    const artifactId = matchGroups.artifactId
      ? matchGroups.artifactId
      : groupId;
    return `${groupId}:${artifactId}`;
  }

  return null;
}

const githubDependencyRegex = regEx(
  /^(?:com|io)\.github\.(?<packageName>[^/]+\/[^/]+)$/,
);
const gitlabDependencyRegex = regEx(
  /^(?:com|io)\.gitlab\.(?<packageName>[^/]+\/[^/]+)$/,
);
const bitbucketDependencyRegex = regEx(
  /^(?:org|io)\.bitbucket\.(?<packageName>[^/]+\/[^/]+)$/,
);

function resolveGitPackageFromEdnKey(
  dep: PackageDependency,
  key: string,
): void {
  if (dep.datasource) {
    return;
  }

  const githubDependencyGroups = githubDependencyRegex.exec(key)?.groups;
  if (githubDependencyGroups?.packageName) {
    dep.datasource = GithubTagsDatasource.id;
    dep.packageName = githubDependencyGroups.packageName;
    return;
  }

  const gitlabDependencyGroups = gitlabDependencyRegex.exec(key)?.groups;
  if (gitlabDependencyGroups?.packageName) {
    dep.datasource = GitlabTagsDatasource.id;
    dep.packageName = gitlabDependencyGroups.packageName;
    return;
  }

  const bitbucketDependencyGroups = bitbucketDependencyRegex.exec(key)?.groups;
  if (bitbucketDependencyGroups?.packageName) {
    dep.datasource = BitbucketTagsDatasource.id;
    dep.packageName = bitbucketDependencyGroups.packageName;
    return;
  }
}

const githubUrlRegex = regEx(
  /^(?:https:\/\/|git@)github\.com[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/,
);
const gitlabUrlRegex = regEx(
  /^(?:https:\/\/|git@)gitlab\.com[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/,
);
const bitbucketUrlRegex = regEx(
  /^(?:https:\/\/|git@)bitbucket\.org[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/,
);

function resolveGitPackageFromEdnVal(
  dep: PackageDependency,
  val: ParsedEdnRecord,
): void {
  const gitUrl = val['git/url'];
  if (!is.string(gitUrl)) {
    return;
  }

  const githubMatchGroups = githubUrlRegex.exec(gitUrl)?.groups;
  if (githubMatchGroups) {
    dep.datasource = GithubTagsDatasource.id;
    dep.packageName = githubMatchGroups.packageName;
    dep.sourceUrl = `https://github.com/${dep.packageName}`;
    return;
  }

  const gitlabMatchGroups = gitlabUrlRegex.exec(gitUrl)?.groups;
  const bitbucketMatchGroups = bitbucketUrlRegex.exec(gitUrl)?.groups;

  if (gitlabMatchGroups) {
    dep.datasource = GitlabTagsDatasource.id;
    dep.packageName = gitlabMatchGroups.packageName;
    dep.sourceUrl = `https://gitlab.com/${dep.packageName}`;
    return;
  }

  if (bitbucketMatchGroups) {
    dep.datasource = GitlabTagsDatasource.id;
    dep.packageName = bitbucketMatchGroups.packageName;
    dep.sourceUrl = `https://bitbucket.org/${dep.packageName}`;
    return;
  }

  dep.datasource = GitRefsDatasource.id;
  dep.packageName = gitUrl;
  if (gitUrl.startsWith('https://')) {
    dep.sourceUrl = gitUrl.replace(/\.git$/, '');
  }
}

function extractDependency(
  key: string,
  val: ParsedEdnData,
  metadata: ParsedEdnMetadata,
  mavenRegistries: string[],
  depType?: string,
): PackageDependency | null {
  if (!is.plainObject(val)) {
    return null;
  }

  const packageName = getPackageName(key);
  if (!packageName) {
    return null;
  }
  const depName = key;

  const dep: PackageDependency = {
    depName,
    packageName,
    currentValue: null,
    ...metadata.get(val),
  };

  if (depType) {
    dep.depType = depType;
  }

  const mvnVersion = val['mvn/version'];
  if (is.string(mvnVersion)) {
    dep.datasource = ClojureDatasource.id;
    dep.currentValue = mvnVersion;
    dep.packageName = packageName.replace('/', ':');
    dep.registryUrls = [...mavenRegistries];
    return dep;
  }

  resolveGitPackageFromEdnVal(dep, val);
  resolveGitPackageFromEdnKey(dep, key);

  if (dep.datasource) {
    const gitTag = val['git/tag'];
    if (is.string(gitTag)) {
      dep.currentValue = gitTag;
    }

    const gitSha = val['git/sha'] ?? val['sha'];
    if (is.string(gitSha)) {
      dep.currentDigest = gitSha;
      dep.currentDigestShort = gitSha.slice(0, 7);
    }

    return dep;
  }

  return null;
}

function extractSection(
  section: ParsedEdnData,
  metadata: ParsedEdnMetadata,
  mavenRegistries: string[],
  depType?: string,
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  if (is.plainObject(section)) {
    for (const [key, val] of Object.entries(section)) {
      const dep = extractDependency(
        key,
        val,
        metadata,
        mavenRegistries,
        depType,
      );
      if (dep) {
        deps.push(dep);
      }
    }
  }
  return deps;
}

export function extractPackageFile(content: string): PackageFileContent | null {
  const parsed = parseDepsEdnFile(content);
  if (!parsed) {
    return null;
  }
  const { data, metadata } = parsed;

  const deps: PackageDependency[] = [];

  // See: https://clojure.org/reference/deps_and_cli#_modifying_the_default_repositories
  const registryMap: Record<string, string> = {
    clojars: CLOJARS_REPO,
    central: MAVEN_REPO,
  };
  const mavenRepos = data['mvn/repos'];
  if (is.plainObject(mavenRepos)) {
    for (const [repoName, repoSpec] of Object.entries(mavenRepos)) {
      if (is.string(repoName)) {
        if (is.plainObject(repoSpec) && is.string(repoSpec.url)) {
          registryMap[repoName] = repoSpec.url;
        } else if (is.string(repoSpec) && repoSpec === 'nil') {
          delete registryMap[repoName];
        }
      }
    }
  }
  const mavenRegistries: string[] = [...Object.values(registryMap)];

  deps.push(...extractSection(data['deps'], metadata, mavenRegistries));

  const aliases = data['aliases'];
  if (is.plainObject(aliases)) {
    for (const [depType, aliasSection] of Object.entries(aliases)) {
      if (is.plainObject(aliasSection)) {
        deps.push(
          ...extractSection(
            aliasSection['extra-deps'],
            metadata,
            mavenRegistries,
            depType,
          ),
        );
        deps.push(
          ...extractSection(
            aliasSection['override-deps'],
            metadata,
            mavenRegistries,
            depType,
          ),
        );
      }
    }
  }

  return { deps };
}

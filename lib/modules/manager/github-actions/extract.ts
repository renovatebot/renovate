import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import { logger, withMeta } from '../../../logger/index.ts';
import { detectPlatform } from '../../../util/common.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { ForgejoTagsDatasource } from '../../datasource/forgejo-tags/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubRunnersDatasource } from '../../datasource/github-runners/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import * as dockerVersioning from '../../versioning/docker/index.ts';
import * as nodeVersioning from '../../versioning/node/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { CommunityActions } from './community.ts';
import type { DockerReference, RepositoryReference } from './parse.ts';
import { isSha, isShortSha, parseUsesLine } from './parse.ts';
import type { Steps } from './schema.ts';
import { Workflow } from './schema.ts';

// detects if we run against a Github Enterprise Server and adds the URL to the beginning of the registryURLs for looking up Actions
// This reflects the behavior of how GitHub looks up Actions
// First on the Enterprise Server, then on GitHub.com
function detectCustomGitHubRegistryUrlsForActions(): PackageDependency {
  const endpoint = GlobalConfig.get('endpoint');
  const registryUrls = ['https://github.com'];
  if (endpoint && GlobalConfig.get('platform') === 'github') {
    const parsedEndpoint = new URL(endpoint);

    if (
      parsedEndpoint.host !== 'github.com' &&
      parsedEndpoint.host !== 'api.github.com'
    ) {
      registryUrls.unshift(
        `${parsedEndpoint.protocol}//${parsedEndpoint.host}`,
      );
      return { registryUrls };
    }
  }
  return {};
}

function extractDockerAction(
  actionRef: DockerReference,
  config: ExtractConfig,
): PackageDependency {
  const dep = getDep(actionRef.originalRef, true, config.registryAliases);
  dep.depType = 'docker';
  dep.replaceString = actionRef.originalRef;
  return dep;
}

function extractRepositoryAction(
  actionRef: RepositoryReference,
  parsed: ReturnType<typeof parseUsesLine> & object,
  customRegistryUrlsPackageDependency: PackageDependency,
): PackageDependency {
  const {
    replaceString: valueString,
    quote,
    commentData,
    commentPrecedingWhitespace,
  } = parsed;
  const {
    owner,
    repo,
    path: subPath,
    ref,
    hostname,
    isExplicitHostname,
  } = actionRef;

  const registryUrl = isExplicitHostname ? `https://${hostname}/` : '';
  const packageName = `${owner}/${repo}`;
  const depName = `${registryUrl}${packageName}`;
  const pathSuffix = subPath ? `/${subPath}` : '';
  const commentWs = commentPrecedingWhitespace || ' ';

  const dep: PackageDependency = {
    depName,
    commitMessageTopic: '{{{depName}}} action',
    datasource: GithubTagsDatasource.id,
    versioning: dockerVersioning.id,
    depType: 'action',
    replaceString: valueString,
    autoReplaceStringTemplate: `${quote}{{depName}}${pathSuffix}@{{#if newDigest}}{{newDigest}}${quote}{{#if newValue}}${commentWs}# {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}${quote}{{/unless}}`,
    ...(isExplicitHostname
      ? detectDatasource(registryUrl)
      : customRegistryUrlsPackageDependency),
  };

  if (packageName !== depName) {
    dep.packageName = packageName;
  }

  // Extend replaceString to include relevant comment portions:
  // - Pinned version: include only up to the version (truncate trailing text)
  // - Ratchet exclude: include the full comment to preserve the marker
  if (
    commentData.pinnedVersion &&
    !is.undefined(commentData.index) &&
    !is.undefined(commentData.matchedString)
  ) {
    const cleanComment = parsed.commentString.slice(1);
    const matchEndIndex = commentData.index + commentData.matchedString.length;
    const commentSuffix = cleanComment.slice(0, matchEndIndex);
    dep.replaceString =
      valueString + commentPrecedingWhitespace + '#' + commentSuffix;
  } else if (commentData.ratchetExclude) {
    dep.replaceString =
      valueString + commentPrecedingWhitespace + parsed.commentString;
  }

  if (isSha(ref)) {
    dep.currentValue = commentData.pinnedVersion;
    dep.currentDigest = ref;
  } else if (isShortSha(ref)) {
    dep.currentValue = commentData.pinnedVersion;
    dep.currentDigestShort = ref;
  } else {
    dep.currentValue = ref;
  }

  return dep;
}

function extractWithRegex(
  content: string,
  config: ExtractConfig,
): PackageDependency[] {
  const customRegistryUrlsPackageDependency =
    detectCustomGitHubRegistryUrlsForActions();
  logger.trace('github-actions.extractWithRegex()');
  const deps: PackageDependency[] = [];

  for (const line of content.split(newlineRegex)) {
    if (line.trim().startsWith('#')) {
      continue;
    }

    const parsed = parseUsesLine(line);
    if (!parsed?.actionRef) {
      continue;
    }

    const { actionRef } = parsed;

    if (actionRef.kind === 'docker') {
      deps.push(extractDockerAction(actionRef, config));
      continue;
    }

    if (actionRef.kind === 'repository') {
      deps.push(
        extractRepositoryAction(
          actionRef,
          parsed,
          customRegistryUrlsPackageDependency,
        ),
      );
    }
  }

  return deps;
}

function detectDatasource(registryUrl: string): PackageDependency {
  const platform = detectPlatform(registryUrl);

  switch (platform) {
    case 'forgejo':
      return {
        registryUrls: [registryUrl],
        datasource: ForgejoTagsDatasource.id,
      };
    case 'gitea':
      return {
        registryUrls: [registryUrl],
        datasource: GiteaTagsDatasource.id,
      };
    case 'github':
      return { registryUrls: [registryUrl] };
  }

  return {
    skipReason: 'unsupported-url',
  };
}

const runnerVersionRegex = regEx(
  /^\s*(?<depName>[a-zA-Z]+)-(?<currentValue>[^\s]+)/,
);

function extractRunner(runner: string): PackageDependency | null {
  const runnerVersionGroups = runnerVersionRegex.exec(runner)?.groups;
  if (!runnerVersionGroups) {
    return null;
  }

  const { depName, currentValue } = runnerVersionGroups;

  if (!GithubRunnersDatasource.isValidRunner(depName, currentValue)) {
    return null;
  }

  const dependency: PackageDependency = {
    depName,
    currentValue,
    replaceString: `${depName}-${currentValue}`,
    depType: 'github-runner',
    datasource: GithubRunnersDatasource.id,
    autoReplaceStringTemplate: '{{depName}}-{{newValue}}',
  };

  if (!dockerVersioning.api.isValid(currentValue)) {
    dependency.skipReason = 'invalid-version';
  }

  return dependency;
}

// For official https://github.com/actions
const versionedActions: Record<string, string> = {
  go: npmVersioning.id,
  node: nodeVersioning.id,
  python: npmVersioning.id,

  // Not covered yet because they use different datasources/packageNames:
  // - dotnet
  // - java
};

function extractVersionedAction(step: Steps): PackageDependency | null {
  for (const [action, versioning] of Object.entries(versionedActions)) {
    const actionName = `actions/setup-${action}`;
    if (step.uses !== actionName && !step.uses?.startsWith(`${actionName}@`)) {
      continue;
    }

    const fieldName = `${action}-version`;
    const currentValue = step.with?.[fieldName];
    if (!currentValue) {
      return null;
    }

    return {
      datasource: GithubReleasesDatasource.id,
      depName: action,
      packageName: `actions/${action}-versions`,
      versioning,
      extractVersion: '^(?<version>\\d+\\.\\d+\\.\\d+)(-\\d+)?$',
      currentValue,
      depType: 'uses-with',
    };
  }
  return null;
}

function extractSteps(steps: Steps[]): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const step of steps) {
    const res = CommunityActions.safeParse(step);
    if (res.success) {
      deps.push(res.data);
      continue;
    }

    const versionedDep = extractVersionedAction(step);
    if (versionedDep) {
      deps.push(versionedDep);
    }
  }

  return deps;
}

function extractWithYAMLParser(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageDependency[] {
  logger.trace('github-actions.extractWithYAMLParser()');

  const obj = withMeta({ packageFile }, () => Workflow.parse(content));
  if (!obj) {
    return [];
  }

  if ('runs' in obj && obj.runs.steps) {
    return extractSteps(obj.runs.steps);
  }

  if (!('jobs' in obj)) {
    return [];
  }

  const deps: PackageDependency[] = [];

  for (const job of Object.values(obj.jobs)) {
    if (job.container) {
      const dep = getDep(job.container, true, config.registryAliases);
      if (dep) {
        dep.depType = 'container';
        deps.push(dep);
      }
    }

    for (const service of job.services) {
      const dep = getDep(service, true, config.registryAliases);
      if (dep) {
        dep.depType = 'service';
        deps.push(dep);
      }
    }

    for (const runner of job['runs-on']) {
      const dep = extractRunner(runner);
      if (dep) {
        deps.push(dep);
      }
    }

    deps.push(...extractSteps(job.steps));
  }

  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig = {}, // TODO: enforce ExtractConfig
): PackageFileContent | null {
  logger.trace(`github-actions.extractPackageFile(${packageFile})`);

  const deps = [
    ...extractWithRegex(content, config),
    ...extractWithYAMLParser(content, packageFile, config),
  ];

  if (!deps.length) {
    return null;
  }

  return { deps };
}

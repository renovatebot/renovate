import { GlobalConfig } from '../../../config/global';
import { logger, withMeta } from '../../../logger';
import { detectPlatform } from '../../../util/common';
import { newlineRegex, regEx } from '../../../util/regex';
import { ForgejoTagsDatasource } from '../../datasource/forgejo-tags';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubRunnersDatasource } from '../../datasource/github-runners';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as dockerVersioning from '../../versioning/docker';
import * as nodeVersioning from '../../versioning/node';
import * as npmVersioning from '../../versioning/npm';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { CommunityActions } from './community';
import type { Steps } from './schema';
import { Workflow } from './schema';

const dockerActionRe = regEx(/^\s+uses\s*: ['"]?docker:\/\/([^'"]+)\s*$/);
const actionRe = regEx(
  /^\s+-?\s+?uses\s*: (?<replaceString>['"]?(?<depName>(?<registryUrl>https:\/\/[.\w-]+\/)?(?<packageName>[\w-]+\/[.\w-]+))(?<path>\/.*)?@(?<currentValue>[^\s'"]+)['"]?(?:(?<commentWhiteSpaces>\s+)#\s*(((?:renovate\s*:\s*)?(?:pin\s+|tag\s*=\s*)?|(?:ratchet:[\w-]+\/[.\w-]+)?)@?(?<tag>([\w-]*[-/])?v?\d+(?:\.\d+(?:\.\d+)?)?)|(?:ratchet:exclude)))?)/,
);

// SHA1 or SHA256, see https://github.blog/2020-10-19-git-2-29-released/
const shaRe = regEx(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const shaShortRe = regEx(/^[a-f0-9]{6,7}$/);

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

    const dockerMatch = dockerActionRe.exec(line);
    if (dockerMatch) {
      const [, currentFrom] = dockerMatch;
      const dep = getDep(currentFrom, true, config.registryAliases);
      dep.depType = 'docker';
      deps.push(dep);
      continue;
    }

    const tagMatch = actionRe.exec(line);
    if (tagMatch?.groups) {
      const {
        depName,
        packageName,
        currentValue,
        path = '',
        tag,
        replaceString,
        registryUrl = '',
        commentWhiteSpaces = ' ',
      } = tagMatch.groups;
      let quotes = '';
      if (replaceString.includes("'")) {
        quotes = "'";
      }
      if (replaceString.includes('"')) {
        quotes = '"';
      }
      const dep: PackageDependency = {
        depName,
        ...(packageName !== depName && { packageName }),
        commitMessageTopic: '{{{depName}}} action',
        datasource: GithubTagsDatasource.id,
        versioning: dockerVersioning.id,
        depType: 'action',
        replaceString,
        autoReplaceStringTemplate: `${quotes}{{depName}}${path}@{{#if newDigest}}{{newDigest}}${quotes}{{#if newValue}}${commentWhiteSpaces}# {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}${quotes}{{/unless}}`,
        ...(registryUrl
          ? detectDatasource(registryUrl)
          : customRegistryUrlsPackageDependency),
      };
      if (shaRe.test(currentValue)) {
        dep.currentValue = tag;
        dep.currentDigest = currentValue;
      } else if (shaShortRe.test(currentValue)) {
        dep.currentValue = tag;
        dep.currentDigestShort = currentValue;
      } else {
        dep.currentValue = currentValue;
      }
      deps.push(dep);
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

const versionedActions: Record<string, string> = {
  go: npmVersioning.id,
  node: nodeVersioning.id,
  python: npmVersioning.id,
  // Not covered yet because they use different datasources/packageNames:
  // - dotnet
  // - java
};

function extractSteps(
  steps: Steps[],
  deps: PackageDependency<Record<string, any>>[],
): void {
  for (const step of steps) {
    const res = CommunityActions.safeParse(step);
    if (res.success) {
      deps.push(res.data);
      continue;
    }

    for (const [action, versioning] of Object.entries(versionedActions)) {
      const actionName = `actions/setup-${action}`;
      if (step.uses === actionName || step.uses?.startsWith(`${actionName}@`)) {
        const fieldName = `${action}-version`;
        const currentValue = step.with?.[fieldName];
        if (currentValue) {
          deps.push({
            datasource: GithubReleasesDatasource.id,
            depName: action,
            packageName: `actions/${action}-versions`,
            versioning,
            extractVersion: '^(?<version>\\d+\\.\\d+\\.\\d+)(-\\d+)?$', // Actions release tags are like 1.24.1-13667719799
            currentValue,
            depType: 'uses-with',
          });
        }
      }
    }
  }
}

function extractWithYAMLParser(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageDependency[] {
  logger.trace('github-actions.extractWithYAMLParser()');
  const deps: PackageDependency[] = [];

  const obj = withMeta({ packageFile }, () => Workflow.parse(content));

  if (!obj) {
    return deps;
  }

  // composite action
  if ('runs' in obj && obj.runs.steps) {
    extractSteps(obj.runs.steps, deps);
  } else if ('jobs' in obj) {
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

      extractSteps(job.steps, deps);
    }
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

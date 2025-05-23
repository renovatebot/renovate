import { GlobalConfig } from '../../../config/global';
import { logger, withMeta } from '../../../logger';
import { detectPlatform } from '../../../util/common';
import { newlineRegex, regEx } from '../../../util/regex';
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
import type { Steps } from './schema';
import { WorkflowSchema } from './schema';

const dockerActionRe = regEx(/^\s+uses\s*: ['"]?docker:\/\/([^'"]+)\s*$/);
const actionRe = regEx(
  /^\s+-?\s+?uses\s*: (?<replaceString>['"]?(?<depName>(?<registryUrl>https:\/\/[.\w-]+\/)?(?<packageName>[\w-]+\/[.\w-]+))(?<path>\/.*)?@(?<currentValue>[^\s'"]+)['"]?(?:(?<commentWhiteSpaces>\s+)#\s*(((?:renovate\s*:\s*)?(?:pin\s+|tag\s*=\s*)?|(?:ratchet:[\w-]+\/[.\w-]+)?)@?(?<tag>([\w-]*[-/])?v?\d+(?:\.\d+(?:\.\d+)?)?)|(?:ratchet:exclude)))?)/,
);

//#region Container job regular expressions

// This group of regexes is used to detect the container image in a GitHub
// Actions [container job], keeping the comment so that it can be updated in the
// same way as for `uses:`.
//
// The container image can be specified in two ways:
//
// - as a string, e.g
//   ```yaml
//   - container: 'foo/bar@sha256:123456' # v1.2.3
//   ```
// - as an object, e.g.
//   ```yaml
//   container:
//     - image: 'foo/bar@sha256:123456' # v1.2.3
//   ```
//
// [container job]: https://docs.github.com/en/actions/writing-workflows/choosing-where-your-workflow-runs/running-jobs-in-a-container

// Match `- container:`
const containerRe = regEx(/^\s*-?\s+?container\s*:\s*/);

// Match `'foo/bar@sha256:123456' # v1.2.3`
const containerImageRe = regEx(
  /(?<replaceString>(?<quotes>['"]?)(?<currentValue>[^'"#\s]+)['"]?(?:(?<commentWhiteSpaces>\s+)?#\s*(?<tag>[^\s]+))?)/,
);

// Match `- container: 'foo/bar@sha256:123456' # v1.2.3`
const fullContainerRe = regEx(
  new RegExp(containerRe.source + containerImageRe.source),
);

// Match `image: 'foo/bar@sha256:123456' # v1.2.3`
const containerObjectImageRe = regEx(
  String.raw`^\s*image\s*:\s*` + containerImageRe.source,
);

//#endregion

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

  // Track whether we are currently inside a container object.
  let lastLineWasContainer = false;

  for (const line of content.split(newlineRegex)) {
    if (line.trim().startsWith('#')) {
      continue;
    }

    if (line.trim() === '') {
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

    const containerMatch = lastLineWasContainer
      ? containerObjectImageRe.exec(line)
      : fullContainerRe.exec(line);

    const containerGroups = containerMatch?.groups;
    if (containerGroups) {
      const {
        commentWhiteSpaces = '',
        currentValue,
        replaceString,
        tag,
        quotes = '',
      } = containerGroups;
      const dep: PackageDependency = getDep(currentValue);
      // There are two ways image references can be specified.
      //
      // 1. Version inline: `foo/bar:v1.2.3@sha256:123456`. This case is easy: the reference
      //    image is already in a format we understand.

      // 2. Version in comment: `foo/bar@sha256:123456 # v1.2.3`. We extract the
      //    version from the comment:
      if (tag && !dep.currentValue) {
        dep.currentValue = tag;
        dep.autoReplaceStringTemplate = `${quotes}{{depName}}{{#if newDigest}}@{{newDigest}}{{#if newValue}}${quotes}${commentWhiteSpaces}#{{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}${quotes}{{/unless}}`;
      }

      dep.depType = 'container';
      dep.replaceString = replaceString;

      deps.push(dep);
    }

    /**
     * Detect lines line
     *
     * - container:
     *     image: 'foo/bar@sha256:123456' # v1.2.3
     *
     * by naively tracking if we are in a `container` object.
     */
    if (containerRe.test(line)) {
      lastLineWasContainer = true;
      continue;
    }

    lastLineWasContainer = false;
  }

  return deps;
}

function detectDatasource(registryUrl: string): PackageDependency {
  const platform = detectPlatform(registryUrl);

  switch (platform) {
    case 'github':
      return { registryUrls: [registryUrl] };
    case 'gitea':
      return {
        registryUrls: [registryUrl],
        datasource: GiteaTagsDatasource.id,
      };
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

  const obj = withMeta({ packageFile }, () => WorkflowSchema.parse(content));

  if (!obj) {
    return deps;
  }

  // composite action
  if ('runs' in obj && obj.runs.steps) {
    extractSteps(obj.runs.steps, deps);
  } else if ('jobs' in obj) {
    for (const job of Object.values(obj.jobs)) {
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

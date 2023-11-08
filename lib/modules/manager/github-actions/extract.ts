import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import { newlineRegex, regEx } from '../../../util/regex';
import { GithubRunnersDatasource } from '../../datasource/github-runners';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as dockerVersioning from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';
import type { Workflow } from './types';

const dockerActionRe = regEx(/^\s+uses: ['"]?docker:\/\/([^'"]+)\s*$/);
const actionRe = regEx(
  /^\s+-?\s+?uses: (?<replaceString>['"]?(?<depName>[\w-]+\/[.\w-]+)(?<path>\/.*)?@(?<currentValue>[^\s'"]+)['"]?(?:\s+#\s*(?:renovate\s*:\s*)?(?:pin\s+|tag\s*=\s*)?@?(?<tag>v?\d+(?:\.\d+(?:\.\d+)?)?))?)/,
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

function extractWithRegex(content: string): PackageDependency[] {
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
      const dep = getDep(currentFrom);
      dep.depType = 'docker';
      deps.push(dep);
      continue;
    }

    const tagMatch = actionRe.exec(line);
    if (tagMatch?.groups) {
      const {
        depName,
        currentValue,
        path = '',
        tag,
        replaceString,
      } = tagMatch.groups;
      let quotes = '';
      if (replaceString.indexOf("'") >= 0) {
        quotes = "'";
      }
      if (replaceString.indexOf('"') >= 0) {
        quotes = '"';
      }
      const dep: PackageDependency = {
        depName,
        commitMessageTopic: '{{{depName}}} action',
        datasource: GithubTagsDatasource.id,
        versioning: dockerVersioning.id,
        depType: 'action',
        replaceString,
        autoReplaceStringTemplate: `${quotes}{{depName}}${path}@{{#if newDigest}}{{newDigest}}${quotes}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}${quotes}{{/unless}}`,
        ...customRegistryUrlsPackageDependency,
      };
      if (shaRe.test(currentValue)) {
        dep.currentValue = tag;
        dep.currentDigest = currentValue;
      } else if (shaShortRe.test(currentValue)) {
        dep.currentValue = tag;
        dep.currentDigestShort = currentValue;
      } else {
        dep.currentValue = currentValue;
        if (!dockerVersioning.api.isValid(currentValue)) {
          dep.skipReason = 'invalid-version';
        }
      }
      deps.push(dep);
    }
  }
  return deps;
}

function extractContainer(container: unknown): PackageDependency | undefined {
  if (is.string(container)) {
    return getDep(container);
  } else if (is.plainObject(container) && is.string(container.image)) {
    return getDep(container.image);
  }
  return undefined;
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

function extractRunners(runner: unknown): PackageDependency[] {
  const runners: string[] = [];
  if (is.string(runner)) {
    runners.push(runner);
  } else if (is.array(runner, is.string)) {
    runners.push(...runner);
  }

  return runners.map(extractRunner).filter(isNotNullOrUndefined);
}

function extractWithYAMLParser(
  content: string,
  packageFile: string,
): PackageDependency[] {
  logger.trace('github-actions.extractWithYAMLParser()');
  const deps: PackageDependency[] = [];

  let pkg: Workflow;
  try {
    pkg = load(content, { json: true }) as Workflow;
  } catch (err) {
    logger.debug(
      { packageFile, err },
      'Failed to parse GitHub Actions Workflow YAML',
    );
    return [];
  }

  for (const job of Object.values(pkg?.jobs ?? {})) {
    const dep = extractContainer(job?.container);
    if (dep) {
      dep.depType = 'container';
      deps.push(dep);
    }

    for (const service of Object.values(job?.services ?? {})) {
      const dep = extractContainer(service);
      if (dep) {
        dep.depType = 'service';
        deps.push(dep);
      }
    }

    deps.push(...extractRunners(job?.['runs-on']));
  }

  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`github-actions.extractPackageFile(${packageFile})`);
  const deps = [
    ...extractWithRegex(content),
    ...extractWithYAMLParser(content, packageFile),
  ];
  if (!deps.length) {
    return null;
  }
  return { deps };
}

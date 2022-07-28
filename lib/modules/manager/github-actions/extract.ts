import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as dockerVersioning from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type { Container, Job, Workflow } from './types';

const dockerActionRe = regEx(/^\s+uses: ['"]?docker:\/\/([^'"]+)\s*$/);
const actionRe = regEx(
  /^\s+-?\s+?uses: (?<replaceString>['"]?(?<depName>[\w-]+\/[\w-]+)(?<path>\/.*)?@(?<currentValue>[^\s'"]+)['"]?(?:\s+#\s+(?:renovate:\s+)?tag=(?<tag>\S+))?)/
);

// SHA1 or SHA256, see https://github.blog/2020-10-19-git-2-29-released/
const shaRe = regEx(/^[a-z0-9]{40}|[a-z0-9]{64}$/);

function extractActionsFromPackageFile(content: string): PackageDependency[] {
  logger.trace('github-actions.extractActionsFromPackageFile()');
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
      dep.versioning = dockerVersioning.id;
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
        autoReplaceStringTemplate: `${quotes}{{depName}}${path}@{{#if newDigest}}{{newDigest}}${quotes}{{#if newValue}} # tag={{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}${quotes}{{/unless}}`,
      };
      if (shaRe.test(currentValue)) {
        dep.currentValue = tag;
        dep.currentDigest = currentValue;
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

function extractContainer(
  container: string | Container | undefined
): PackageDependency | null {
  if (container === undefined) {
    return null;
  }

  let dep: PackageDependency;
  if (typeof container === 'string') {
    dep = getDep(container);
  } else {
    dep = getDep(container.image ?? '');
  }

  dep.versioning = dockerVersioning.id;
  return dep;
}

function extractContainersFromPackageFile(
  content: string
): PackageDependency[] {
  logger.trace('github-actions.extractContainersFromPackageFile()');
  const deps: PackageDependency[] = [];

  const pkg = load(content, { json: true }) as Workflow;

  Object.entries(pkg.jobs ?? {}).forEach(([, job]: [string, Job]) => {
    const dep = extractContainer(job.container);
    if (dep !== null) {
      dep.depType = 'container';
      deps.push(dep);
    }

    Object.entries(job.services ?? {}).forEach(
      ([, service]: [string, string | Container]) => {
        const dep = extractContainer(service);
        if (dep !== null) {
          dep.depType = 'service';
          deps.push(dep);
        }
      }
    );
  });

  return deps;
}

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('github-actions.extractPackageFile()');
  const deps = [
    ...extractActionsFromPackageFile(content),
    ...extractContainersFromPackageFile(content),
  ];
  if (!deps.length) {
    return null;
  }
  return { deps };
}

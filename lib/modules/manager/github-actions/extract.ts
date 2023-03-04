import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as dockerVersioning from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';
import type { Workflow } from './types';

const dockerActionRe = regEx(/^\s+uses: ['"]?docker:\/\/([^'"]+)\s*$/);
const actionRe = regEx(
  /^\s+-?\s+?uses: (?<replaceString>['"]?(?<depName>[\w-]+\/[\w-]+)(?<path>\/.*)?@(?<currentValue>[^\s'"]+)['"]?(?:\s+#\s*(?:renovate\s*:\s*)?(?:pin\s+|tag\s*=\s*)?@?(?<tag>v?\d+(?:\.\d+(?:\.\d+)?)?))?)/
);

// SHA1 or SHA256, see https://github.blog/2020-10-19-git-2-29-released/
const shaRe = regEx(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const shaShortRe = regEx(/^[a-f0-9]{6,7}$/);

function extractWithRegex(content: string): PackageDependency[] {
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

function extractWithYAMLParser(
  content: string,
  filename: string
): PackageDependency[] {
  logger.trace('github-actions.extractWithYAMLParser()');
  const deps: PackageDependency[] = [];

  let pkg: Workflow;
  try {
    pkg = load(content, { json: true }) as Workflow;
  } catch (err) {
    logger.debug(
      { filename, err },
      'Failed to parse GitHub Actions Workflow YAML'
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
  }

  return deps;
}

export function extractPackageFile(
  content: string,
  filename: string
): PackageFileContent | null {
  logger.trace('github-actions.extractPackageFile()');
  const deps = [
    ...extractWithRegex(content),
    ...extractWithYAMLParser(content, filename),
  ];
  if (!deps.length) {
    return null;
  }
  return { deps };
}

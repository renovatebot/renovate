import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as dockerVersioning from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

const dockerRe = regEx(/^\s+uses: docker:\/\/([^"]+)\s*$/);
const actionRe = regEx(
  /^\s+-?\s+?uses: (?<replaceString>['"]?(?<depName>[\w-]+\/[\w-]+)(?<path>\/.*)?@(?<currentValue>[^\s'"]+)['"]?(?:\s+#\s+(?:renovate:\s+)?tag=(?<tag>\S+))?)/
);

// SHA1 or SHA256, see https://github.blog/2020-10-19-git-2-29-released/
const shaRe = regEx(/^[a-z0-9]{40}|[a-z0-9]{64}$/);

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('github-actions.extractPackageFile()');
  const deps: PackageDependency[] = [];
  for (const line of content.split(newlineRegex)) {
    if (line.trim().startsWith('#')) {
      continue;
    }

    const dockerMatch = dockerRe.exec(line);
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
  if (!deps.length) {
    return null;
  }
  return { deps };
}

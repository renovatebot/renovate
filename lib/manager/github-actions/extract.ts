import * as githubTagsDatasource from '../../datasource/github-tags';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import * as dockerVersioning from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

const dockerRe = /^\s+uses: docker:\/\/([^"]+)\s*$/;
const actionRe =
  /^\s+-?\s+?uses: (?<depName>[\w-]+\/[\w-]+)(?<path>.*)?@(?<currentValue>.+?)(?: # renovate: tag=(?<tag>.+?))?\s*?$/;

// SHA1 or SHA256, see https://github.blog/2020-10-19-git-2-29-released/
const shaRe = /^[a-z0-9]{40}|[a-z0-9]{64}$/;

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('github-actions.extractPackageFile()');
  const deps: PackageDependency[] = [];
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('#')) {
      continue; // eslint-disable-line no-continue
    }

    const dockerMatch = dockerRe.exec(line);
    if (dockerMatch) {
      const [, currentFrom] = dockerMatch;
      const dep = getDep(currentFrom);
      dep.depType = 'docker';
      dep.versioning = dockerVersioning.id;
      deps.push(dep);
      continue; // eslint-disable-line no-continue
    }

    const tagMatch = actionRe.exec(line);
    if (tagMatch?.groups) {
      const { depName, currentValue, tag } = tagMatch.groups;
      if (shaRe.test(currentValue)) {
        const dep: PackageDependency = {
          depName,
          currentValue: tag,
          currentDigest: currentValue,
          commitMessageTopic: '{{{depName}}} action',
          datasource: githubTagsDatasource.id,
          versioning: dockerVersioning.id,
          depType: 'action',
          pinDigests: false,
          replaceString: line,
        };
        deps.push(dep);
      } else {
        const dep: PackageDependency = {
          depName,
          currentValue,
          commitMessageTopic: '{{{depName}}} action',
          datasource: githubTagsDatasource.id,
          versioning: dockerVersioning.id,
          depType: 'action',
          pinDigests: false,
        };
        if (!dockerVersioning.api.isValid(currentValue)) {
          dep.skipReason = SkipReason.InvalidVersion;
        }
        deps.push(dep);
      }
    }
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

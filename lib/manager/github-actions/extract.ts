import * as githubTagsDatasource from '../../datasource/github-tags';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import * as dockerVersioning from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('github-actions.extractPackageFile()');
  const deps: PackageDependency[] = [];
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('#')) {
      continue; // eslint-disable-line no-continue
    }

    const dockerMatch = /^\s+uses: docker:\/\/([^"]+)\s*$/.exec(line);
    if (dockerMatch) {
      const [, currentFrom] = dockerMatch;
      const dep = getDep(currentFrom);
      dep.depType = 'docker';
      dep.versioning = dockerVersioning.id;
      deps.push(dep);
      continue; // eslint-disable-line no-continue
    }

    const tagMatch = /^\s+-?\s+?uses: (?<depName>[\w-]+\/[\w-]+)(?<path>.*)?@(?<currentValue>.+?)\s*?$/.exec(
      line
    );
    if (tagMatch?.groups) {
      const { depName, currentValue } = tagMatch.groups;
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
  if (!deps.length) {
    return null;
  }
  return { deps };
}

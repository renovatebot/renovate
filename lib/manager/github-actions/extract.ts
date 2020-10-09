import * as githubTagsDatasource from '../../datasource/github-tags';
import { logger } from '../../logger';
import * as dockerVersioning from '../../versioning/docker';
import * as looseVersioning from '../../versioning/loose';
import { PackageDependency, PackageFile } from '../common';
import { getDep } from '../dockerfile/extract';

export function extractPackageFile(content: string): PackageFile | null {
  logger.debug('github-actions.extractPackageFile()');
  const deps: PackageDependency[] = [];
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('#')) {
      continue; // eslint-disable-line no-continue
    }

    const dockerMatch = /^\s+uses: docker:\/\/([^"]+)\s*$/.exec(line);
    if (dockerMatch) {
      const [, currentFrom] = dockerMatch;
      const dep = getDep(currentFrom);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Docker image inside GitHub Workflow'
      );
      dep.versioning = dockerVersioning.id;
      deps.push(dep);
      continue; // eslint-disable-line no-continue
    }

    const tagMatch = /^^\s+-?\s+?uses: (?<depName>[\w-]+\/[\w-]+)(?<path>.*)?@(?<currentValue>.+?)\s*?$/.exec(
      line
    );
    if (tagMatch?.groups) {
      const { depName, currentValue } = tagMatch.groups;
      if (looseVersioning.api.isValid(currentValue)) {
        const dep: PackageDependency = {
          depName,
          currentValue,
          commitMessageTopic: '{{depName}}} action',
          datasource: githubTagsDatasource.id,
          versioning: looseVersioning.id,
          rangeStrategy: 'pin',
        };
        logger.debug(dep, 'GitHub Action inside GitHub Workflow');
        deps.push(dep);
      }
    }
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

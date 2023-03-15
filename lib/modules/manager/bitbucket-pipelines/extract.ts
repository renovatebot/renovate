import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { BitBucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';

const pipeRegex = regEx(`^\\s*-\\s?pipe:\\s*'?"?([^\\s'"]+)'?"?\\s*$`);
const dockerImageRegex = regEx(`^\\s*-?\\s?image:\\s*'?"?([^\\s'"]+)'?"?\\s*$`);

export function extractPackageFile(content: string): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  try {
    const lines = content.split(newlineRegex);
    for (const line of lines) {
      const pipeMatch = pipeRegex.exec(line);
      if (pipeMatch) {
        const pipe = pipeMatch[1];

        if (pipe.startsWith('docker://')) {
          const currentPipe = pipe.replace('docker://', '');
          addDepAsDockerImage(deps, currentPipe);
        } else {
          addDepAsBitbucketTag(deps, pipe);
        }
      }

      const dockerImageMatch = dockerImageRegex.exec(line);
      if (dockerImageMatch) {
        const currentFrom = dockerImageMatch[1];
        addDepAsDockerImage(deps, currentFrom);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting Bitbucket Pipes dependencies');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
function addDepAsBitbucketTag(
  deps: PackageDependency<Record<string, any>>[],
  pipe: string
): void {
  const [depName, currentValue] = pipe.split(':');

  const dep: PackageDependency = {
    depName,
    currentValue,
    datasource: BitBucketTagsDatasource.id,
  };

  logger.trace(
    {
      depName: dep.depName,
      currentValue: dep.currentValue,
    },
    'Bitbucket pipe tag'
  );
  deps.push(dep);
}

function addDepAsDockerImage(
  deps: PackageDependency<Record<string, any>>[],
  currentDockerImage: string
): void {
  const dep = getDep(currentDockerImage);

  logger.trace(
    {
      depName: dep.depName,
      currentValue: dep.currentValue,
      currentDigest: dep.currentDigest,
    },
    'Docker image'
  );
  deps.push(dep);
}

import { logger } from '../../../logger';
import { newlineRegex } from '../../../util/regex';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import {
  addDepAsBitbucketTag,
  addDepAsDockerImage,
  addDepFromObject,
  dockerImageObjectRegex,
  dockerImageRegex,
  pipeRegex,
} from './util';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  try {
    const lines = content
      .replaceAll(/^\s*\r?\n/gm, '') // replace empty lines
      .replaceAll(/^\s*#.*\r?\n/gm, '') // replace comment lines
      .split(newlineRegex);
    const len = lines.length;
    for (let lineIdx = 0; lineIdx < len; lineIdx++) {
      const line = lines[lineIdx];

      const dockerImageObjectGroups = dockerImageObjectRegex.exec(line)?.groups;
      if (dockerImageObjectGroups) {
        // image object
        // https://support.atlassian.com/bitbucket-cloud/docs/docker-image-options/
        lineIdx = addDepFromObject(
          deps,
          lines,
          lineIdx,
          len,
          dockerImageObjectGroups.spaces,
          config.registryAliases,
        );
        continue;
      }

      const pipeMatch = pipeRegex.exec(line);
      if (pipeMatch) {
        const pipe = pipeMatch[1];

        if (pipe.startsWith('docker://')) {
          const currentPipe = pipe.replace('docker://', '');
          addDepAsDockerImage(deps, currentPipe, config.registryAliases);
        } else {
          addDepAsBitbucketTag(deps, pipe);
        }
        continue;
      }

      const dockerImageMatch = dockerImageRegex.exec(line);
      if (dockerImageMatch) {
        const currentFrom = dockerImageMatch[1];
        addDepAsDockerImage(deps, currentFrom, config.registryAliases);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { err, packageFile },
      'Error extracting Bitbucket Pipes dependencies',
    );
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

import { logger } from '../../logger';
import type { PackageDependency, PackageFile } from '../types';
import { extractCollections } from './collections';
import { extractCollectionsMetaDataFile } from './collections-metadata';
import { extractRoles } from './roles';

export function getSliceEndNumber(
  start: number,
  numberOfLines: number,
  ...blocks: number[]
): number {
  if (start < 0 || start > numberOfLines - 1) {
    return -1;
  }
  let nearestEnd = numberOfLines - 1;
  for (const blocksKey of blocks) {
    if (start < blocksKey && blocksKey < nearestEnd) {
      nearestEnd = blocksKey;
    }
  }
  return nearestEnd;
}

export default function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace('ansible-galaxy.extractPackageFile()');
  const galaxyFileNameRegEx = /galaxy\.ya?ml$/;
  const deps: PackageDependency[] = [];
  const lines = content.split('\n');

  try {
    // if this is a galaxy.yml file we have to interpret the dependencies differently
    if (galaxyFileNameRegEx.exec(fileName)) {
      const galaxyDeps = extractCollectionsMetaDataFile(lines);
      deps.push(...galaxyDeps);
    } else {
      // interpret requirements file
      // check if new or old format is used and save start lines for collection and roles.
      const positions = {
        collections: -1,
        roles: -1,
      };
      // find role and collection block
      lines.forEach((line, index) => {
        if (/^collections:/.exec(line)) {
          positions.collections = index;
        }
        if (/^roles:/.exec(line)) {
          positions.roles = index;
        }
      });
      if (positions.collections >= 0 || positions.roles >= 0) {
        // using new format
        const collectionLines = lines.slice(
          positions.collections,
          getSliceEndNumber(
            positions.collections,
            lines.length,
            positions.roles
          )
        );
        const collectionDeps = extractCollections(collectionLines);
        deps.push(...collectionDeps);

        const roleLines = lines.slice(
          positions.roles,
          getSliceEndNumber(
            positions.roles,
            lines.length,
            positions.collections
          )
        );
        const roleDeps = extractRoles(roleLines);
        deps.push(...roleDeps);
      } else {
        // use old format which only has only roles
        const galaxyDeps = extractRoles(lines);
        deps.push(...galaxyDeps);
      }
    }

    if (!deps.length) {
      return null;
    }
    return { deps };
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Error extracting ansible-galaxy deps');
    return null;
  }
}

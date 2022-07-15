import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalDirectory } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { HermitDatasource } from '../../datasource/hermit';
import type { PackageDependency, PackageFile } from '../types';
import type { HermitListItem } from './types';

const pkgReferenceRegex = regEx(`(?<packageName>.*?)-(?<version>[0-9]{1}.*)`);

/**
 * extractPackageFile scans the folder of the package files
 * and looking for .{packageName}-{version}.pkg
 */
export async function extractPackageFile(
  content: string,
  filename: string
): Promise<PackageFile | null> {
  logger.trace('hermit.extractPackageFile()');
  const dependencies = [] as PackageDependency[];
  const packages = await listHermitPackages(filename);

  if (packages === null) {
    logger.warn(`error listing hermit packages`);
    return null;
  }

  for (const p of packages) {
    // version of a hermit package is either a Version or a Channel
    // Channel will prepend with @ to distinguish from normal version
    const version = p.Version ?? `@${p.Channel ?? ''}`;

    const dep: PackageDependency = {
      datasource: HermitDatasource.id,
      depName: p.Name,
      currentValue: version,
    };

    dependencies.push(dep);
  }

  return { deps: dependencies };
}

/**
 * listHermitPackages will fetch all installed packages from the bin folder
 */
async function listHermitPackages(
  hermitFile: string
): Promise<HermitListItem[] | null> {
  logger.trace('hermit.listHermitPackages()');
  const hermitFolder = upath.dirname(hermitFile);

  let files: string[] = [];

  try {
    files = await readLocalDirectory(hermitFolder);
  } catch (e) {
    logger.warn(
      { hermitFolder, error: e },
      'error listing hermit package references'
    );
    return null;
  }

  logger.debug({ files, hermitFolder }, 'files for hermit package list');

  return files
    .filter((f) => minimatch(f, '.*.pkg'))
    .map((f): HermitListItem | null => {
      const fileName = f
        .replace(`${hermitFolder}/`, '')
        .substring(1)
        .replace(/\.pkg$/, '');
      const channelParts = fileName.split('@');

      if (channelParts.length > 1) {
        return {
          Name: channelParts[0],
          Channel: channelParts[1],
        };
      }

      const groups = pkgReferenceRegex.exec(fileName)?.groups;
      if (!groups) {
        logger.debug(
          { fileName },
          'invalid hermit package reference file name found'
        );
        return null;
      }

      return {
        Name: groups.packageName,
        Version: groups.version,
      };
    })
    .filter(is.truthy);
}

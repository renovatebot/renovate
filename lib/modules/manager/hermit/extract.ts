import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { readLocalDirectorySync } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { HermitDatasource } from '../../datasource/hermit';
import type { PackageDependency, PackageFile, Result } from '../types';
import type { HermitListItem } from './types';

const pkgReferenceRegex = regEx(`(?<packageName>.*?)-(?<version>[0-9]{1}.*)`);

/**
 * extractPackageFile scans the folder of the package files
 * and looking for .{packageName}-{version}.pkg
 */
export function extractPackageFile(
  content: string,
  filename: string
): Result<PackageFile> | null {
  logger.trace('hermit.extractPackageFile()');
  const dependencies = [] as PackageDependency[];
  try {
    const packages = listHermitPackages(filename);

    if (packages === null) {
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
  } catch (e) {
    logger.warn({ err: e }, `error listing hermit packages`);
    return null;
  }

  return { deps: dependencies };
}

/**
 * listHermitPackages will fetch all installed packages from the bin folder
 */
function listHermitPackages(hermitFile: string): HermitListItem[] | null {
  logger.trace('hermit.listHermitPackages()');

  const localDir = GlobalConfig.get('localDir');
  const hermitFolder = upath.join(localDir, upath.dirname(hermitFile));
  const files = readLocalDirectorySync(hermitFolder);

  if (files === null) {
    logger.debug({ hermitFolder }, 'error listing hermit package references');
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

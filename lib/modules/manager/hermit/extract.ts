import fs from 'fs-extra';
import minimatch from 'minimatch';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { HermitDatasource } from '../../datasource/hermit';
import type { PackageDependency, PackageFile, Result } from '../types';
import type { HermitListItem } from './types';

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

    logger.trace({});

    for (const p of packages) {
      // version of a hermit package is either a Version or a Channel
      // Channel will prepend with @ to distinguish from normal version
      const version = p.Version ?? `@${p.Channel}`;

      const dep: PackageDependency = {
        datasource: HermitDatasource.id,
        depName: p.Name,
        currentValue: version,
      };

      dependencies.push(dep);
    }
  } catch (e) {
    logger.warn({ err: e }, `error listing hermit packages`);
    throw e;
  }

  return { deps: dependencies };
}

/**
 * listHermitPackages will fetch all installed packages from the bin folder
 */
function listHermitPackages(hermitFile: string): HermitListItem[] {
  logger.trace('hermit.listHermitPackages()');

  const localDir = GlobalConfig.get('localDir');
  const hermitFolder = upath.join(localDir, upath.dirname(hermitFile));
  const files = fs.readdirSync(hermitFolder);

  logger.debug({ files, hermitFolder }, 'files for hermit package list');
  return files
    .filter((f) => minimatch(f, '.*.pkg'))
    .map((f): HermitListItem => {
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

      let hyphenIndex = fileName.indexOf('-');

      while (hyphenIndex >= 0 && hyphenIndex < fileName.length - 1) {
        const nextCh = fileName[hyphenIndex + 1];
        if (nextCh >= '0' && nextCh <= '9') {
          const name = fileName.substring(0, hyphenIndex);
          const version = fileName.substring(hyphenIndex + 1);
          return {
            Name: name,
            Version: version,
          };
        }

        hyphenIndex = fileName.indexOf('-', hyphenIndex + 1);
      }

      return {
        Name: '',
      };
    })
    .filter((i) => i.Name !== '');
}

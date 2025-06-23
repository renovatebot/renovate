import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalDirectory } from '../../../util/fs';
import { minimatch } from '../../../util/minimatch';
import { regEx } from '../../../util/regex';
import { HermitDatasource } from '../../datasource/hermit';
import type { PackageDependency, PackageFileContent } from '../types';
import type { HermitListItem } from './types';

const pkgReferenceRegex = regEx(`(?<packageName>.*?)-(?<version>[0-9]{1}.*)`);

/**
 * extractPackageFile scans the folder of the package files
 * and looking for .{packageName}-{version}.pkg
 */
export async function extractPackageFile(
  _content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`hermit.extractPackageFile(${packageFile})`);
  const dependencies = [] as PackageDependency[];
  const packages = await listHermitPackages(packageFile);

  if (!packages?.length) {
    return null;
  }

  for (const p of packages) {
    // version of a hermit package is either a Version or a Channel
    // Channel will prepend with @ to distinguish from normal version
    const version = p.Version === '' ? `@${p.Channel}` : p.Version;

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
  packageFile: string,
): Promise<HermitListItem[] | null> {
  logger.trace('hermit.listHermitPackages()');
  const hermitFolder = upath.dirname(packageFile);

  let files: string[] = [];

  try {
    files = await readLocalDirectory(hermitFolder);
  } catch (err) {
    logger.debug(
      { hermitFolder, err, packageFile },
      'error listing hermit package references',
    );
    return null;
  }

  logger.trace({ files, hermitFolder }, 'files for hermit package list');

  const out = [] as HermitListItem[];

  for (const f of files) {
    if (!minimatch('.*.pkg').match(f)) {
      continue;
    }

    const fileName = f
      .replace(`${hermitFolder}/`, '')
      .substring(1)
      .replace(/\.pkg$/, '');
    const channelParts = fileName.split('@');

    if (channelParts.length > 1) {
      out.push({
        Name: channelParts[0],
        Channel: channelParts[1],
        Version: '',
      });
    }

    const groups = pkgReferenceRegex.exec(fileName)?.groups;
    if (!groups) {
      logger.debug(
        { fileName },
        'invalid hermit package reference file name found',
      );
      continue;
    }

    out.push({
      Name: groups.packageName,
      Version: groups.version,
      Channel: '',
    });
  }

  return out;
}

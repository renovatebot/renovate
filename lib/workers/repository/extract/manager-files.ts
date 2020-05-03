import is from '@sindresorhus/is';
import { RenovateConfig } from '../../../config/common';
import { logger } from '../../../logger';
import {
  extractAllPackageFiles,
  extractPackageFile,
  get,
} from '../../../manager';
import { PackageFile } from '../../../manager/common';
import { platform } from '../../../platform';
import { readLocalFile } from '../../../util/fs';
import {
  filterIgnoredFiles,
  getIncludedFiles,
  getMatchingFiles,
} from './file-match';

export async function getManagerPackageFiles(
  config: RenovateConfig
): Promise<PackageFile[]> {
  const { manager, enabled, includePaths, ignorePaths } = config;
  logger.trace(`getPackageFiles(${manager})`);
  if (!enabled) {
    logger.debug(`${manager} is disabled`);
    return [];
  }
  let fileList = await platform.getFileList();
  fileList = getIncludedFiles(fileList, includePaths);
  fileList = filterIgnoredFiles(fileList, ignorePaths);
  const matchedFiles = getMatchingFiles(fileList, manager, config.fileMatch);
  // istanbul ignore else
  if (is.nonEmptyArray(matchedFiles)) {
    logger.debug(
      `Matched ${
        matchedFiles.length
      } file(s) for manager ${manager}: ${matchedFiles.join(', ')}`
    );
  } else {
    return [];
  }
  // Extract package files synchronously if manager requires it
  if (get(manager, 'extractAllPackageFiles')) {
    const allPackageFiles = await extractAllPackageFiles(
      manager,
      config,
      matchedFiles
    );
    if (allPackageFiles) {
      for (const packageFile of allPackageFiles) {
        for (let index = 0; index < packageFile.deps.length; index += 1) {
          packageFile.deps[index].depIndex = index;
        }
      }
    }
    return allPackageFiles;
  }
  const packageFiles = [];
  for (const packageFile of matchedFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (content) {
      const res = await extractPackageFile(
        manager,
        content,
        packageFile,
        config
      );
      if (res) {
        for (let index = 0; index < res.deps.length; index += 1) {
          res.deps[index].depIndex = index;
        }
        packageFiles.push({
          packageFile,
          manager,
          ...res,
        });
      }
    } else {
      // istanbul ignore next
      logger.debug({ packageFile }, 'packageFile has no content');
    }
  }
  return packageFiles;
}

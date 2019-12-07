import {
  extractAllPackageFiles,
  extractPackageFile,
  get,
} from '../../../manager';
import { platform } from '../../../platform';
import { logger } from '../../../logger';
import {
  filterIgnoredFiles,
  getIncludedFiles,
  getMatchingFiles,
} from './file-match';
import { PackageFile } from '../../../manager/common';

export async function getManagerPackageFiles(config): Promise<PackageFile[]> {
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
  if (matchedFiles && matchedFiles.length) {
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
    return extractAllPackageFiles(manager, config, matchedFiles);
  }
  const packageFiles = [];
  for (const packageFile of matchedFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      const res = await extractPackageFile(
        manager,
        content,
        packageFile,
        config
      );
      if (res) {
        packageFiles.push({
          packageFile,
          manager,
          ...res,
        });
      }
    } else {
      // istanbul ignore next
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }
  return packageFiles;
}

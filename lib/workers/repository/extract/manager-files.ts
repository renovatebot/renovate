import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import {
  extractAllPackageFiles,
  extractPackageFile,
  get,
} from '../../../modules/manager';
import type { PackageFile } from '../../../modules/manager/types';
import { readLocalFile } from '../../../util/fs';
import type { WorkerExtractConfig } from '../../types';

export async function getManagerPackageFiles(
  config: WorkerExtractConfig,
): Promise<PackageFile[] | null> {
  const { enabled, manager, fileList } = config;
  logger.trace(`getPackageFiles(${manager})`);
  if (!enabled) {
    logger.debug(`${manager} is disabled`);
    return [];
  }
  // istanbul ignore else
  if (is.nonEmptyArray(fileList)) {
    logger.debug(
      `Matched ${
        fileList.length
      } file(s) for manager ${manager}: ${fileList.join(', ')}`,
    );
  } else {
    return [];
  }
  // Extract package files synchronously if manager requires it
  if (get(manager, 'extractAllPackageFiles')) {
    const allPackageFiles = await extractAllPackageFiles(
      manager,
      config,
      fileList,
    );
    return allPackageFiles;
  }
  const packageFiles: PackageFile[] = [];
  for (const packageFile of fileList) {
    const content = await readLocalFile(packageFile, 'utf8');
    // istanbul ignore else
    if (content) {
      const res = await extractPackageFile(
        manager,
        content,
        packageFile,
        config,
      );
      if (res) {
        packageFiles.push({
          ...res,
          packageFile,
        });
      }
    } else {
      logger.debug(`${packageFile} has no content`);
    }
  }
  return packageFiles;
}

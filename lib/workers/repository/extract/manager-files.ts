import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import {
  extractAllPackageFiles,
  extractPackageFile,
  get,
} from '../../../manager';
import type { PackageFile } from '../../../manager/types';
import { readLocalFile } from '../../../util/fs';

export async function getManagerPackageFiles(
  config: RenovateConfig
): Promise<PackageFile[]> {
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
      } file(s) for manager ${manager}: ${fileList.join(', ')}`
    );
  } else {
    return [];
  }
  // Extract package files synchronously if manager requires it
  if (get(manager, 'extractAllPackageFiles')) {
    const allPackageFiles = await extractAllPackageFiles(
      manager,
      config,
      fileList
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
  const packageFiles: PackageFile[] = [];
  for (const packageFile of fileList) {
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

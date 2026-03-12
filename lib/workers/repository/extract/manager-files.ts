import { isNonEmptyArray } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import {
  extractAllPackageFiles,
  extractPackageFile,
  get,
} from '../../../modules/manager/index.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import type { WorkerExtractConfig } from '../../types.ts';

function massageDepNames(packageFiles: PackageFile[] | null): void {
  if (packageFiles) {
    for (const packageFile of packageFiles) {
      for (const dep of packageFile.deps) {
        if (dep.packageName && !dep.depName) {
          dep.depName = dep.packageName;
        }
      }
    }
  }
}

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
  if (isNonEmptyArray(fileList)) {
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
    massageDepNames(allPackageFiles);
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
  massageDepNames(packageFiles);
  return packageFiles;
}

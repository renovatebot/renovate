import is from '@sindresorhus/is';
import type {
  RenovateConfig,
  WorkerExtractConfig,
} from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import { getManagerPackageFiles } from './manager-files';

export async function extractAllDependencies(
  config: RenovateConfig,
  extractList: WorkerExtractConfig[]
): Promise<Record<string, PackageFile[]>> {
  const extractResults = await Promise.all(
    extractList.map(async (managerConfig) => {
      const packageFiles = await getManagerPackageFiles(managerConfig);
      for (const p of packageFiles ?? []) {
        for (const dep of p.deps ?? []) {
          if (!config.updateInternalDeps && dep.isInternal) {
            dep.skipReason = 'internal-package';
          }
        }
      }

      return { manager: managerConfig.manager, packageFiles };
    })
  );
  const extractions: Record<string, PackageFile[]> = {};
  let fileCount = 0;
  for (const { manager, packageFiles } of extractResults) {
    if (packageFiles?.length) {
      fileCount += packageFiles.length;
      logger.debug(`Found ${manager} package files`);
      extractions[manager] = (extractions[manager] || []).concat(packageFiles);
    }
  }
  logger.debug(`Found ${fileCount} package file(s)`);

  // If enabledManagers is non-empty, check that each of them has at least one extraction.
  // If not, log a warning to indicate possible misconfiguration.
  if (is.nonEmptyArray(config.enabledManagers)) {
    for (const enabledManager of config.enabledManagers) {
      if (!(enabledManager in extractions)) {
        logger.debug(
          { manager: enabledManager },
          `Manager explicitly enabled in "enabledManagers" config, but found no results. Possible config error?`
        );
      }
    }
  }

  return extractions;
}

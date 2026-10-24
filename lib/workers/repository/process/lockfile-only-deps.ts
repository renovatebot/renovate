import { getManagerConfig, mergeChildConfig } from '../../../config/index.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import { coerceObject } from '../../../util/object.ts';
import { applyPackageRules } from '../../../util/package-rules/index.ts';
import { hasVulnerabilityAlertsRules } from '../extract/vulnerability-alerts.ts';

/**
 * Clears the `lockfile-only` skip reason from any dependency a vulnerability
 * alert matches, so a security update can be looked up for it.
 */
export async function unskipLockfileOnlyDeps(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  if (!hasVulnerabilityAlertsRules(config)) {
    return;
  }

  // TODO: `lookup()` can be called with no extract result at all (#22198)
  for (const [manager, managerPackageFiles] of Object.entries(
    coerceObject(packageFiles),
  )) {
    let managerConfig: RenovateConfig | undefined;

    for (const pFile of managerPackageFiles) {
      const lockfileOnlyDeps = pFile.deps.filter(
        (dep) => dep.skipReason === 'lockfile-only',
      );
      if (!lockfileOnlyDeps.length) {
        continue;
      }

      managerConfig ??= getManagerConfig(config, manager);
      const packageFileConfig = mergeChildConfig(managerConfig, pFile);

      for (const dep of lockfileOnlyDeps) {
        const depConfig = await applyPackageRules(
          mergeChildConfig(packageFileConfig, dep),
          'pre-lookup',
        );
        if (!depConfig.isVulnerabilityAlert) {
          continue;
        }

        logger.debug(
          {
            packageFile: pFile.packageFile,
            depName: dep.depName,
            packageName: dep.packageName,
            manager,
            datasource: dep.datasource,
          },
          `Clearing skipReason=lockfile-only for ${dep.depName!}, as a vulnerability alert matches it`,
        );
        delete dep.skipReason;
        delete dep.skipStage;
      }
    }
  }
}

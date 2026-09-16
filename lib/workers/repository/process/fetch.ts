// TODO #22198
import { isNonEmptyString } from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config/index.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import { instrument } from '../../../instrumentation/index.ts';
import { logger } from '../../../logger/index.ts';
import { getDefaultVersioning } from '../../../modules/datasource/common.ts';
import { applyDatasourceDefaultConfig } from '../../../modules/datasource/index.ts';
import type {
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../../../modules/manager/types.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { clone } from '../../../util/clone.ts';
import { applyPackageRules } from '../../../util/package-rules/index.ts';
import * as p from '../../../util/promises.ts';
import { Result } from '../../../util/result.ts';
import { LookupStats } from '../../../util/stats.ts';
import { PackageFiles } from '../package-files.ts';
import { lookupUpdates } from './lookup/index.ts';
import type { LookupUpdateConfig, UpdateResult } from './lookup/types.ts';

type LookupResult = Result<PackageDependency>;

/**
 * Merge the constraints which a manager extracted into `target`, without ever letting them override a value which was configured.
 *
 * `overrides` holds the values which must win over the extracted ones: the repository config for a package file, the package file config for a dependency. They cannot be read from `target`, because `mergeChildConfig()` has already merged `constraintsVersioning` from `extracted` into it, the other way round.
 */
function mergeExtractedConstraints(
  target: RenovateConfig,
  extracted: Pick<
    PackageFileContent,
    'extractedConstraints' | 'constraintsVersioning'
  >,
  overrides: Pick<RenovateConfig, 'constraints' | 'constraintsVersioning'>,
): void {
  if (extracted.extractedConstraints) {
    target.constraints = {
      ...extracted.extractedConstraints,
      ...overrides.constraints,
    };
  }
  const constraintsVersioning = {
    ...extracted.constraintsVersioning,
    ...overrides.constraintsVersioning,
  };
  if (Object.keys(constraintsVersioning).length > 0) {
    target.constraintsVersioning = constraintsVersioning;
  }
}

async function lookup(
  packageFileConfig: RenovateConfig & PackageFile,
  indep: PackageDependency,
): Promise<LookupResult> {
  const dep = clone(indep);

  dep.updates = [];

  if (dep.skipReason) {
    return Result.ok(dep);
  }

  if (!isNonEmptyString(dep.packageName)) {
    dep.skipReason = 'invalid-name';
    return Result.ok(dep);
  }

  if (dep.isInternal && !packageFileConfig.updateInternalDeps) {
    dep.skipReason = 'internal-package';
    return Result.ok(dep);
  }

  const { depName } = dep;
  // TODO: fix types
  let depConfig = mergeChildConfig(packageFileConfig, dep);
  mergeExtractedConstraints(depConfig, dep, packageFileConfig);
  depConfig = await applyDatasourceDefaultConfig(depConfig);
  depConfig.versioning ??= getDefaultVersioning(depConfig.datasource);
  depConfig = await applyPackageRules(depConfig, 'pre-lookup');

  if (depConfig.ignoreDeps!.includes(depName!)) {
    // TODO: fix types (#22198)
    logger.debug(`Dependency: ${depName!}, is ignored`);
    dep.skipReason = 'ignored';
    return Result.ok(dep);
  }

  if (depConfig.enabled === false) {
    logger.debug(`Dependency: ${depName!}, is disabled`);
    dep.skipReason = 'disabled';
    return Result.ok(dep);
  }

  if (!depConfig.datasource) {
    return Result.ok(dep);
  }

  return LookupStats.wrap(depConfig.datasource, async () => {
    const { packageFile, manager } = packageFileConfig;
    return await Result.wrap(lookupUpdates(depConfig as LookupUpdateConfig))
      .onValue((dep) => {
        logger.trace(
          { dep, packageFile, manager },
          'Dependency lookup success',
        );
      })
      .onError((err) => {
        logger.trace(
          { err, depName, packageFile, manager },
          'Dependency lookup error',
        );
      })
      .catch((err): Result<UpdateResult> => {
        if (
          packageFileConfig.repoIsOnboarded === true ||
          !(err instanceof ExternalHostError)
        ) {
          return Result.err(err);
        }

        const cause = err.err;
        return Result.ok({
          updates: [],
          warnings: [
            {
              topic: 'Lookup Error',
              message: `${depName}: ${cause.message}`,
            },
          ],
        });
      })
      .transform((upd): PackageDependency => Object.assign(dep, upd));
  });
}

async function fetchManagerPackagerFileUpdates(
  config: RenovateConfig,
  managerConfig: RenovateConfig,
  pFile: PackageFile,
): Promise<void> {
  const { packageFile } = pFile;
  const packageFileConfig = mergeChildConfig(managerConfig, pFile);
  mergeExtractedConstraints(packageFileConfig, pFile, config);
  const { manager } = packageFileConfig;
  const queue = pFile.deps.map(
    (dep) => async (): Promise<PackageDependency> => {
      const updates = await lookup(packageFileConfig, dep);
      return updates.unwrapOrThrow();
    },
  );
  logger.trace(
    { manager, packageFile, queueLength: queue.length },
    'fetchManagerPackagerFileUpdates starting with concurrency',
  );

  pFile.deps = await p.all(queue);
  logger.trace(
    { manager, packageFile },
    'fetchManagerPackagerFileUpdates finished',
  );
}

async function fetchManagerUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
  manager: string,
): Promise<void> {
  const managerConfig = getManagerConfig(config, manager);
  const queue = packageFiles[manager].map(
    (pFile) => (): Promise<void> =>
      fetchManagerPackagerFileUpdates(config, managerConfig, pFile),
  );
  logger.trace(
    { manager, queueLength: queue.length },
    'fetchManagerUpdates starting',
  );
  await p.all(queue);
  logger.trace({ manager }, 'fetchManagerUpdates finished');
}

export async function fetchUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  const managers = Object.keys(packageFiles);
  const allManagerJobs = managers.map((manager) =>
    instrument(manager, () =>
      fetchManagerUpdates(config, packageFiles, manager),
    ),
  );
  await Promise.all(allManagerJobs);
  PackageFiles.add(config.baseBranch!, { ...packageFiles });
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups complete',
  );
}

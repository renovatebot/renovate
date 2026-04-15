import { logger } from '../../../logger/index.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { api as composer } from '../../versioning/composer/index.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import { Lockfile } from './schema.ts';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `composer.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  try {
    const lockfile = Json.pipe(Lockfile).parse(lockFileContent);
    if (
      lockfile?.packages.find(
        ({ name, version }) =>
          name === depName && composer.equals(version, newVersion),
      )
    ) {
      return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'composer.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}

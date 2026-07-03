import { logger } from '../../../logger/index.ts';
import type {
  ManagerData,
  UpdateLockedConfig,
  UpdateLockedResult,
} from '../types.ts';
import { parse as parseLockFile } from './parsers/lock-file.ts';
import type { PaketManagerData } from './types.ts';

export function updateLockedDependency({
  depName,
  currentVersion,
  newVersion,
  lockFile,
  lockFileContent,
  managerData,
}: UpdateLockedConfig & ManagerData<PaketManagerData>): UpdateLockedResult {
  logger.debug(
    `paket.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );

  try {
    const group = managerData?.group;
    const lockedEntries = parseLockFile(lockFileContent!).filter(
      (dep) =>
        dep.packageName.toUpperCase() === depName.toUpperCase() &&
        (!group || dep.groupName.toUpperCase() === group.toUpperCase()),
    );
    if (
      lockedEntries.length &&
      lockedEntries.every((dep) => dep.version === newVersion)
    ) {
      return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'paket.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}

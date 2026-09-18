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

  if (!lockFileContent) {
    return { status: 'update-failed' };
  }

  const packageName = depName.toUpperCase();
  const groupName = managerData?.group?.toUpperCase();
  const lockedEntries = parseLockFile(lockFileContent).filter(
    (dep) =>
      dep.packageName.toUpperCase() === packageName &&
      (!groupName || dep.groupName.toUpperCase() === groupName),
  );
  if (
    lockedEntries.length &&
    lockedEntries.every((dep) => dep.version === newVersion)
  ) {
    return { status: 'already-updated' };
  }
  return { status: 'unsupported' };
}

import { DateTime } from 'luxon';
import { logger } from '../../logger/index.ts';
import { getCache } from '../cache/repository/index.ts';

export function getCachedUpdateDateResult(
  branchName: string,
  branchSha: string | null,
): DateTime | null {
  if (!branchSha) {
    return null;
  }

  const cache = getCache();
  const branch = cache.branches?.find((br) => br.branchName === branchName);

  if (branch?.sha === branchSha && branch.commitTimestamp !== undefined) {
    return DateTime.fromISO(branch.commitTimestamp);
  }

  return null;
}

export function setCachedUpdateDateResult(
  branchName: string,
  updateDate: DateTime,
): void {
  const cache = getCache();
  const branch = cache.branches?.find((br) => br.branchName === branchName);

  if (!branch) {
    logger.debug(`setCachedUpdateDateResult(): Branch cache not present`);
    return;
  }

  branch.commitTimestamp = updateDate.toISO()!;
}

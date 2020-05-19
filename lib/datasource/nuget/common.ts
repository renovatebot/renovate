import { logger } from '../../logger';
import { DatasourceError } from '../common';

export const id = 'nuget';

export function handleError(
  err: Error,
  pkgName: string,
  feedUrl: string
): null {
  if (err.statusCode === 401) {
    logger.warn({ feedUrl, pkgName }, 'Unauthorized nuget lookup');
    logger.debug({ err });
    return null;
  }
  if (err.statusCode === 403) {
    logger.warn({ feedUrl, pkgName }, 'nuget lookup forbidden');
    logger.debug({ err });
    return null;
  }
  if (
    err.statusCode === 429 ||
    (err.statusCode >= 500 && err.statusCode < 600)
  ) {
    throw new DatasourceError(err);
  }
  logger.warn(
    { err },
    `nuget datasource ${feedUrl} lookup failure: Unknown error`
  );
  return null;
}

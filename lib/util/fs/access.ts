import upath from 'upath';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';

export function assertBaseDir(path: string, baseDir: string): void {
  if (!path.startsWith(upath.resolve(baseDir))) {
    logger.warn(
      { path, baseDir },
      'Preventing access to file outside the base directory'
    );
    throw new Error(FILE_ACCESS_VIOLATION_ERROR);
  }
}

import { logger } from '../../../logger';
import { MiseFile } from './schema';

export function parseTomlFile(
  content: string,
  packageFile: string,
): MiseFile | null {
  const res = MiseFile.safeParse(content);
  if (res.success) {
    return res.data;
  } else {
    logger.debug({ err: res.error, packageFile }, 'Error parsing Mise file.');
    return null;
  }
}

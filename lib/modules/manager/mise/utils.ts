import { logger } from '../../../logger';
import type { MiseFileSchema } from './schema';
import { MiseFileSchemaToml } from './schema';

export function parseTomlFile(
  content: string,
  packageFile: string,
): MiseFileSchema | null {
  const res = MiseFileSchemaToml.safeParse(content);
  if (res.success) {
    return res.data;
  } else {
    logger.debug({ err: res.error, packageFile }, 'Error parsing Mise file.');
    return null;
  }
}

import { logger } from '../../../logger';
import { MiseFileSchema, MiseFileSchemaToml } from './schema';

export function parseTomlFile(content: string): MiseFileSchema | null {
  const res = MiseFileSchemaToml.safeParse(content);
  if (res.success) {
    return res.data;
  } else {
    logger.debug({ err: res.error }, 'Error parsing Mise file.');
    return null;
  }
}

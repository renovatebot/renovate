import { logger } from '../../../logger';
import { type PoetrySchema, PoetrySchemaToml } from './schema';

export function parsePoetry(
  fileName: string,
  fileContent: string
): PoetrySchema | null {
  const res = PoetrySchemaToml.safeParse(fileContent);
  if (res.success) {
    return res.data;
  } else {
    logger.debug(
      { err: res.error, fileName },
      'Error parsing poetry lockfile.'
    );
  }
  return null;
}

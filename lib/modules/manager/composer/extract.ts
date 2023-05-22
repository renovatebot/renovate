import { logger } from '../../../logger';
import type { PackageFileContent } from '../types';
import { ComposerExtract } from './schema';

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFileContent | null> {
  const res = await ComposerExtract.safeParseAsync({ content, fileName });
  if (!res.success) {
    logger.debug({ fileName, err: res.error }, 'Composer: extract failed');
    return null;
  }
  return res.data;
}

import { logger } from '../../../logger/index.ts';
import type { PackageFileContent } from '../types.ts';
import { ComposerExtract } from './schema.ts';

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  const res = await ComposerExtract.safeParseAsync({
    content,
    fileName: packageFile,
  });
  if (!res.success) {
    logger.debug({ packageFile, err: res.error }, 'Composer: extract failed');
    return null;
  }
  return res.data;
}

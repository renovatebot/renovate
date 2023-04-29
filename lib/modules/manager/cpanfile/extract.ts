import { logger } from '../../../logger';
import type { PackageFileContent } from '../types';
import { cpanfile } from './language';
import { Ctx, query } from './parser';

export function extractPackageFile(
  content: string,
  packageFile?: string
): PackageFileContent | null {
  let parsedResult: Ctx | null = null;

  try {
    parsedResult = cpanfile.query(content, query, {
      deps: [],
    });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, packageFile }, 'cpanfile parsing error');
  }

  if (!parsedResult) {
    return null;
  }

  const { deps } = parsedResult;

  if (!deps.length) {
    return null;
  }

  return { deps };
}

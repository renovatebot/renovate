import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import type { ExtractConfig, PackageFile } from '../types';
import { BatectConfig } from './schema';
import type { ExtractionResult } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string,
): ExtractionResult | null {
  logger.trace(`batect.extractPackageFile(${packageFile})`);

  try {
    const { imageDependencies, bundleDependencies, fileIncludes } =
      BatectConfig.parse(content);
    const deps = [...imageDependencies, ...bundleDependencies];

    const dirName = upath.dirname(packageFile);
    const referencedConfigFiles = fileIncludes.map((file) =>
      upath.join(dirName, file),
    );

    return { deps, referencedConfigFiles };
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Extracting dependencies from Batect configuration file failed',
    );

    return null;
  }
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const filesToExamine = new Set<string>(packageFiles);
  const filesAlreadyExamined = new Set<string>();
  const results: PackageFile[] = [];

  while (filesToExamine.size > 0) {
    const packageFile = filesToExamine.values().next().value!;
    filesToExamine.delete(packageFile);
    filesAlreadyExamined.add(packageFile);

    const content = await readLocalFile(packageFile, 'utf8');
    // TODO #22198
    const result = extractPackageFile(content!, packageFile);

    if (result !== null) {
      result.referencedConfigFiles.forEach((f) => {
        if (!filesAlreadyExamined.has(f) && !filesToExamine.has(f)) {
          filesToExamine.add(f);
        }
      });

      results.push({
        packageFile,
        deps: result.deps,
      });
    }
  }

  return results;
}

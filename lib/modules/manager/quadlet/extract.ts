import ini from 'ini';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

function getQuadletImage(
  image: string | null,
  deps: PackageDependency<Record<string, any>>[],
  config: ExtractConfig,
) {
  if (image) {
    const dep = getDep(image, false, config.registryAliases);
    if (dep) {
      dep.depType = 'image';

      deps.push(dep);
    }
  }
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  let parsedContent;
  try {
    parsedContent = ini.parse(content);
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse quadlet container file',
    );
    return null;
  }
  try {
    const deps: PackageDependency<Record<string, any>>[] = [];

    getQuadletImage(parsedContent?.Container?.Image, deps, config);
    getQuadletImage(parsedContent?.Image?.Image, deps, config);
    getQuadletImage(parsedContent?.Volume?.Image, deps, config);

    if (deps.length) {
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { err, packageFile },
      'Error parsing quadlet container parsed content',
    );
  }
  return null;
}

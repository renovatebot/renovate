import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFileContent } from '../types';
import type { DevContainerFile } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig: ExtractConfig,
): PackageFileContent | null {
  let config: DevContainerFile;
  try {
    config = JSON.parse(content) as DevContainerFile;
  } catch (err) {
    logger.debug({ packageFile, err }, `Failed to parse dev container file`);
    return null;
  }

  try {
    const image = config.image;
    if (image === undefined || image === null) {
      logger.debug(
        `Dev container definition '${packageFile}' does not contain an 'image' property. Skipping.`,
      );
      return null;
    }

    const dep = getDep(image, true, extractConfig.registryAliases);
    return { deps: [dep] };
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { packageFile, err },
      'Error extracting dev container JSON file',
    );
    return null;
  }
}

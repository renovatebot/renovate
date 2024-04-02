import { logger } from '../../../logger';
import { isValidDependency } from '../custom/regex/utils';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { DevContainerFile } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig: ExtractConfig,
): PackageFileContent | null {
  try {
    const file = DevContainerFile.parse(content);
    let targets: string[] = [];
    const image = getImage(file);

    if (image !== undefined && image !== null) {
      targets.push(image);
    } else {
      logger.debug(
        { packageFile },
        'No image defined in dev container JSON file.',
      );
    }

    const features = getFeatures(file);

    if (features.length > 0) {
      targets = targets.concat(features);
    } else {
      logger.debug({ packageFile }, 'No features in dev container JSON file');
    }

    if (targets.length < 1) {
      logger.debug(
        { packageFile },
        'No deps found in dev container JSON file.',
      );
      return null;
    }

    const deps: PackageDependency<Record<string, any>>[] = [];

    for (const target of targets) {
      try {
        const dep = getDep(target, true, extractConfig.registryAliases);
        if (!isValidDependency(dep)) {
          logger.debug(
            { image, packageFile },
            'Skipping invalid dependency in dev container JSON file.',
          );
          continue;
        }
        deps.push(dep);
      } catch (err) {
        logger.debug(
          { target, packageFile },
          'Failed to determine dependency in dev container JSON file.',
        );
      }
    }

    if (deps.length < 1) {
      logger.debug(
        { packageFile },
        'No dependencies to process for dev container JSON file.',
      );
      return null;
    }

    return { deps };
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { err, packageFile },
      'Error extracting dev container JSON file',
    );
    return null;
  }
}

function getImage(file: DevContainerFile): string | null {
  const image = file?.image;
  if (image === undefined || image === null) {
    return null;
  }
  return image;
}

function getFeatures(file: DevContainerFile): string[] {
  const features: string[] = [];
  const fileFeatures = file?.features;

  if (fileFeatures !== undefined && fileFeatures !== null) {
    for (const feature of Object.keys(fileFeatures)) {
      features.push(feature);
    }
  }
  return features;
}

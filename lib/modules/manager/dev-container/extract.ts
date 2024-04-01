import { logger } from '../../../logger';
import { isValidDependency } from '../custom/regex/utils';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { DevContainerFile } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig: ExtractConfig,
): PackageFileContent | null {
  let file: DevContainerFile;
  try {
    file = JSON.parse(content) as DevContainerFile;
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse dev container JSON file',
    );
    return null;
  }

  try {
    let images: string[] = [];
    const image = getImage(file);

    if (image !== undefined && image !== null) {
      images.push(image);
    } else {
      logger.debug(
        { packageFile },
        'No image defined in dev container JSON file.',
      );
    }

    const featureImages = getFeatureImages(file);

    if (featureImages.length > 0) {
      images = images.concat(featureImages);
    } else {
      logger.debug(
        { packageFile },
        'No dev container features in dev container JSON file',
      );
    }

    if (images.length < 1) {
      logger.debug(
        { packageFile },
        'No images found in dev container JSON file.',
      );
      return null;
    }

    const deps: PackageDependency<Record<string, any>>[] = [];

    for (const _image of images) {
      try {
        const dep = getDep(_image, true, extractConfig.registryAliases);
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
          { _image, packageFile },
          'Failed to determine dependency for image in dev container JSON file.',
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

function getFeatureImages(file: DevContainerFile): string[] {
  const images: string[] = [];
  const features = file?.features;

  if (features !== undefined && features !== null) {
    for (const feature of Object.keys(features)) {
      images.push(feature);
    }
  }
  return images;
}

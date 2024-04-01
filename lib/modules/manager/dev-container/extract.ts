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
      { packageFile, err },
      `Failed to parse dev container JSON file`,
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
        `Could not determine image for dev container: ${packageFile}`,
      );
    }

    const featureImages = getFeatureImages(file) ?? [];

    if (featureImages.length > 0) {
      images = images.concat(featureImages);
    } else {
      logger.debug(`Dev container JSON file has no features: ${packageFile}`);
    }

    if (images.length < 1) {
      logger.debug(
        `No images found in dev container JSON file: ${packageFile}`,
      );
      return null;
    }

    const deps: PackageDependency<Record<string, any>>[] = [];

    for (const _image of images) {
      try {
        const dep = getDep(_image, true, extractConfig.registryAliases);
        if (!isValidDependency(dep)) {
          logger.debug(`Skipping invalid dependency: '${image}'`);
          continue;
        }
        deps.push(dep);
      } catch (err) {
        logger.debug(`Failed to determine dependency for image: '${_image}'`);
      }
    }

    if (deps.length < 1) {
      logger.debug(
        `No dev container deps to process for file: '${packageFile}'`,
      );
      return null;
    }

    return { deps };
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { packageFile, err },
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

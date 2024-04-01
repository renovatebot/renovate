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
      `Failed to parse dev container JSON file '${packageFile}': ${err}`,
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
        `No image defined in dev container JSON file '${packageFile}'`,
      );
    }

    const featureImages = getFeatureImages(file) ?? [];

    if (featureImages.length > 0) {
      images = images.concat(featureImages);
    } else {
      logger.debug(
        `No dev container features in dev container JSON file '${packageFile}'`,
      );
    }

    if (images.length < 1) {
      logger.debug(
        `No images found in dev container JSON file '${packageFile}'`,
      );
      return null;
    }

    const deps: PackageDependency<Record<string, any>>[] = [];

    for (const _image of images) {
      try {
        const dep = getDep(_image, true, extractConfig.registryAliases);
        if (!isValidDependency(dep)) {
          logger.debug(
            `Skipping invalid dependency '${image}' in dev container JSON file '${packageFile}'`,
          );
          continue;
        }
        deps.push(dep);
      } catch (err) {
        logger.debug(
          `Failed to determine dependency for image '${_image}' in dev container JSON file '${packageFile}'`,
        );
      }
    }

    if (deps.length < 1) {
      logger.debug(
        `No dependencies to process for dev container JSON file '${packageFile}'`,
      );
      return null;
    }

    return { deps };
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      `Error extracting dev container JSON file '${packageFile}': ${err}`,
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

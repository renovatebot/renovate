import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFileContent } from '../types';
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

    const deps = images.map((image) =>
      getDep(image, true, extractConfig.registryAliases),
    );

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
    for (const feature in features) {
      images.push(feature);
    }
  }
  return images;
}

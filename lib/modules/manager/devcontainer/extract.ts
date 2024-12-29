import { logger } from '../../../logger';
import { isValidDependency } from '../custom/utils';
import { getDep as getDockerDep } from '../dockerfile/extract';
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
    const deps: PackageDependency[] = [];

    const image = file?.image ?? null;
    const imageDep = getDep(image, packageFile, extractConfig.registryAliases);

    if (imageDep) {
      imageDep.depType = 'image';
      deps.push(imageDep);
    } else {
      logger.trace(
        { packageFile },
        'No image defined in dev container JSON file.',
      );
    }

    const features = file.features;

    if (features) {
      for (const feature of Object.keys(features)) {
        const featureDep = getDep(
          feature,
          packageFile,
          extractConfig.registryAliases,
        );
        if (featureDep) {
          featureDep.depType = 'feature';
          featureDep.pinDigests = false;
          deps.push(featureDep);
          continue;
        }
        logger.trace(
          { feature, packageFile },
          'Skipping invalid dependency in dev container JSON file.',
        );
      }
    }

    if (deps.length < 1) {
      logger.trace(
        { packageFile },
        'No dependencies to process for dev container JSON file.',
      );
      return null;
    }

    return { deps };
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Error extracting dev container JSON file.',
    );
    return null;
  }
}

function getDep(
  subject: string | null,
  packageFile: string,
  registryAliases?: Record<string, string>,
): PackageDependency | null {
  if (!subject) {
    return null;
  }
  const dep = getDockerDep(subject, true, registryAliases);
  if (!isValidDependency(dep)) {
    logger.trace(
      { subject, packageFile },
      'Skipping invalid docker dependency in dev container JSON file.',
    );
    return null;
  }
  return dep;
}

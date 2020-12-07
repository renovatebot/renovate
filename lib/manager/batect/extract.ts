import { safeLoad } from 'js-yaml';

import { logger } from '../../logger';
import { PackageFile } from '../common';
import { getDep } from '../dockerfile/extract';

interface BatectConfig {
  containers?: Record<string, BatectContainer>;
}

interface BatectContainer {
  image?: string;
}

function loadConfig(content: string): BatectConfig {
  const config = safeLoad(content);

  if (typeof config !== 'object') {
    throw new Error(
      `Configuration file does not contain a YAML object (it is ${typeof config}).`
    );
  }

  return config as BatectConfig;
}

function uniqueValues<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function extractImages(config: BatectConfig): string[] {
  if (config.containers === undefined) {
    return [];
  }

  const images = Object.values(config.containers)
    .filter((container) => container.image !== undefined)
    .map((container) => container.image);

  return uniqueValues(images);
}

export function extractPackageFile(
  content: string,
  fileName?: string
): PackageFile | null {
  logger.debug('batect.extractPackageFile()');

  try {
    const config = loadConfig(content);
    const images = extractImages(config);
    const deps = images.map((image) => getDep(image));

    if (deps.length === 0) {
      return null;
    }

    logger.trace(
      { deps, fileName },
      'Loaded images from Batect configuration file'
    );

    return { deps };
  } catch (err) {
    logger.error(
      { err, fileName },
      'Extracting dependencies from Batect configuration file failed'
    );

    return null;
  }
}

import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFile } from '../types';
import type { WoodpeckerConfig } from './types';

export function extractPackageFile(
  content: string,
  fileName: string,
  extractConfig: ExtractConfig
): PackageFile | null {
  logger.debug('woodpecker.extractPackageFile()');
  let config: WoodpeckerConfig;
  try {
    // TODO: fix me (#9610)
    config = load(content, { json: true }) as WoodpeckerConfig;
    if (!config) {
      logger.debug(
        { fileName },
        'Null config when parsing Woodpecker Configuration content'
      );
      return null;
    }
    if (typeof config !== 'object') {
      logger.debug(
        { fileName, type: typeof config },
        'Unexpected type for Woodpecker Configuration content'
      );
      return null;
    }
  } catch (err) {
    logger.debug(
      { fileName, err },
      'Error parsing Woodpecker Configuration config YAML'
    );
    return null;
  }

  // Image name/tags for services are only eligible for update if they don't
  // use variables and if the image is not built locally
  const deps = Object.values(config.pipeline ?? {})
    .filter((step) => is.string(step?.image))
    .map((step) => getDep(step.image, true, extractConfig.registryAliases));

  logger.trace({ deps }, 'Woodpecker Configuration image');
  return deps.length ? { deps } : null;
}

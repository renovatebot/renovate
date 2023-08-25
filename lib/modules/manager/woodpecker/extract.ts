import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFileContent } from '../types';
import type { WoodpeckerConfig } from './types';

function woodpeckerVersionDecider(
  woodpeckerConfig: WoodpeckerConfig
): Array<keyof WoodpeckerConfig> {
  const keys: Array<keyof WoodpeckerConfig> = [];

  if ('clone' in woodpeckerConfig) {
    keys.push('clone');
  }

  if ('steps' in woodpeckerConfig) {
    keys.push('steps');
  } else if ('pipeline' in woodpeckerConfig) {
    keys.push('pipeline');
  }

  return keys;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig: ExtractConfig
): PackageFileContent | null {
  logger.debug('woodpecker.extractPackageFile()');
  let config: WoodpeckerConfig;
  try {
    // TODO: fix me (#9610)
    config = load(content, { json: true }) as WoodpeckerConfig;
    if (!config) {
      logger.debug(
        { packageFile },
        'Null config when parsing Woodpecker Configuration content'
      );
      return null;
    }
    if (typeof config !== 'object') {
      logger.debug(
        { packageFile, type: typeof config },
        'Unexpected type for Woodpecker Configuration content'
      );
      return null;
    }
  } catch (err) {
    logger.debug(
      { packageFile, err },
      'Error parsing Woodpecker Configuration config YAML'
    );
    return null;
  }

  const pipelineKeys = woodpeckerVersionDecider(config);

  if (pipelineKeys.length === 0) {
    logger.debug({ packageFile }, "Couldn't identify dependencies");
    return null;
  }

  // Image name/tags for services are only eligible for update if they don't
  // use variables and if the image is not built locally
  const deps = pipelineKeys.flatMap((pipelineKey) =>
    Object.values(config[pipelineKey] ?? {})
      .filter((step) => is.string(step?.image))
      .map((step) => getDep(step.image, true, extractConfig.registryAliases))
  );

  logger.trace({ deps }, 'Woodpecker Configuration image');
  return deps.length ? { deps } : null;
}

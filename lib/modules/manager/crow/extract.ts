import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { parseSingleYaml } from '../../../util/yaml';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFileContent } from '../types';
import type { CrowConfig } from './types';

function crowVersionDecider(
  CrowConfig: CrowConfig,
): (keyof CrowConfig)[] {
  const keys = ['clone', 'steps', 'pipeline', 'services'];
  return Object.keys(CrowConfig).filter((key) =>
    keys.includes(key),
  ) as (keyof CrowConfig)[];
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig: ExtractConfig,
): PackageFileContent | null {
  logger.debug('crow  .extractPackageFile()');
  let config: CrowConfig;
  try {
    // TODO: use schema (#9610)
    config = parseSingleYaml(content);
    if (!config) {
      logger.debug(
        { packageFile },
        'Null config when parsing Crow Configuration content',
      );
      return null;
    }
    if (typeof config !== 'object') {
      logger.debug(
        { packageFile, type: typeof config },
        'Unexpected type for Crow Configuration content',
      );
      return null;
    }
  } catch (err) {
    logger.debug(
      { packageFile, err },
      'Error parsing Crow Configuration config YAML',
    );
    return null;
  }

  const pipelineKeys = crowVersionDecider(config);

  if (pipelineKeys.length === 0) {
    logger.debug({ packageFile }, "Couldn't identify dependencies");
    return null;
  }

  // Image name/tags for services are only eligible for update if they don't
  // use variables and if the image is not built locally
  const deps = pipelineKeys.flatMap((pipelineKey) =>
    Object.values(config[pipelineKey] ?? {})
      .filter((step) => is.string(step?.image))
      .map((step) => getDep(step.image, true, extractConfig.registryAliases)),
  );

  logger.trace({ deps }, 'Crow Configuration image');
  return deps.length ? { deps } : null;
}

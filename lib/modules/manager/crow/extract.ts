import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { parseSingleYaml } from '../../../util/yaml';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFileContent } from '../types';
import { crowConfig } from './schema';
import type { CrowConfigDefinition } from './schema';

function crowVersionDecider(
  config: CrowConfigDefinition,
): (keyof CrowConfigDefinition)[] {
  const keys = ['clone', 'steps', 'pipeline', 'services'];
  return Object.keys(config).filter((key) =>
    keys.includes(key),
  ) as (keyof CrowConfigDefinition)[];
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig: ExtractConfig,
): PackageFileContent | null {
  logger.debug('crow  .extractPackageFile()');
  let config: CrowConfigDefinition;
  try {
    const rawConfig = parseSingleYaml(content);
    const result = crowConfig.safeParse(rawConfig);
    if (!result.success) {
      logger.debug(
        { packageFile, errors: result.error.errors },
        'Invalid Crow Configuration schema',
      );
      return null;
    }
    config = result.data;
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

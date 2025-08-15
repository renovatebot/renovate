import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceObject } from '../../../util/object';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFileContent } from '../types';
import { CrowConfig } from './schema';

function crowVersionDecider(config: CrowConfig): (keyof CrowConfig)[] {
  const keys = ['clone', 'steps', 'pipeline', 'services'];
  return Object.keys(config).filter((key) =>
    keys.includes(key),
  ) as (keyof CrowConfig)[];
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig: ExtractConfig,
): PackageFileContent | null {
  logger.debug('crow  .extractPackageFile()');
  const result = CrowConfig.safeParse(content);
  if (!result.success) {
    logger.debug(
      { packageFile, err: result.error },
      'Invalid Crow Configuration schema',
    );
    return null;
  }

  const config = result.data;
  const pipelineKeys = crowVersionDecider(config);

  if (pipelineKeys.length === 0) {
    logger.debug({ packageFile }, "Couldn't identify dependencies");
    return null;
  }

  // Image name/tags for services are only eligible for update if they don't
  // use variables and if the image is not built locally
  const deps = pipelineKeys.flatMap((pipelineKey) =>
    Object.values(coerceObject(config[pipelineKey]))
      .filter((step) => is.string(step?.image))
      .map((step) => getDep(step.image, true, extractConfig.registryAliases)),
  );

  logger.trace({ deps }, 'Crow Configuration image');
  return deps.length ? { deps } : null;
}

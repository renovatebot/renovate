import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { parseSingleYaml } from '../../../util/yaml';
import { OrbDatasource } from '../../datasource/orb';
import * as npmVersioning from '../../versioning/npm';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { CircleCiFile, type CircleCiJob, type CircleCiOrb } from './schema';

function extractDefinition(
  definition: CircleCiOrb | CircleCiFile,
  config?: ExtractConfig,
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const [key, orb] of Object.entries(definition.orbs ?? {})) {
    if (typeof orb === 'string') {
      const [packageName, currentValue] = orb.split('@');

      deps.push({
        depName: key,
        packageName,
        depType: 'orb',
        currentValue,
        versioning: npmVersioning.id,
        datasource: OrbDatasource.id,
      });
    } else {
      deps.push(...extractDefinition(orb, config));
    }
  }

  // extract environments
  const environments: CircleCiJob[] = [
    Object.values(definition.executors ?? {}),
    Object.values(definition.jobs ?? {}),
  ].flat();
  for (const job of environments) {
    for (const dockerElement of coerceArray(job.docker)) {
      deps.push({
        ...getDep(dockerElement.image, true, config?.registryAliases),
        depType: 'docker',
      });
    }
  }

  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const parsed = parseSingleYaml(content, {
      customSchema: CircleCiFile,
    });

    deps.push(...extractDefinition(parsed, config));

    for (const alias of coerceArray(parsed.aliases)) {
      deps.push({
        ...getDep(alias.image, true, config?.registryAliases),
        depType: 'docker',
      });
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Error extracting circleci images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

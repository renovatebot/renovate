import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { parseSingleYaml } from '../../../util/yaml';
import { OrbDatasource } from '../../datasource/orb';
import * as npmVersioning from '../../versioning/npm';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';
import { CircleCiFile, type CircleCiJob } from './schema';

function extractDefinition(
  definition: CircleCiOrb | CircleCiFile,
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  try {
    const orbs = definition.orbs ?? {};

    for (const [key, orb] of Object.entries(orbs)) {
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
        deps.push(...extractDefinition(orb));
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
          ...getDep(dockerElement.image),
          depType: 'docker',
        });
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Error extracting circleci images');
  }

  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const parsed = parseSingleYaml(content, {
      customSchema: CircleCiFile,
    });

    deps.push(...extractDefinition(parsed));

    for (const alias of coerceArray(parsed.aliases)) {
      deps.push({
        ...getDep(alias.image),
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

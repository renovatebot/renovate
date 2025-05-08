import { logger } from '../../../logger';
import { Result } from '../../../util/result';
import { parseSingleYaml } from '../../../util/yaml';
import { OrbDatasource } from '../../datasource/orb';
import * as npmVersioning from '../../versioning/npm';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { CircleCiFile, type CircleCiOrb } from './schema';

function extractDefinition(
  deps: PackageDependency[],
  definition: CircleCiOrb | CircleCiFile,
  registryAliases: Record<string, string>,
): void {
  for (const [key, orb] of Object.entries(definition.orbs)) {
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
      extractDefinition(deps, orb, registryAliases);
    }
  }

  // extract environments
  const environments = [...definition.executors, ...definition.jobs];
  for (const dockerImage of environments) {
    deps.push({
      ...getDep(dockerImage, true, registryAliases),
      depType: 'docker',
    });
  }
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  const { val: parsed, err } = Result.wrap(() =>
    CircleCiFile.parse(parseSingleYaml(content)),
  ).unwrap();

  if (err) {
    logger.debug({ err, packageFile }, 'Error extracting circleci images');
    return null;
  }

  const registryAliases = config?.registryAliases ?? {};
  const deps: PackageDependency[] = [];
  extractDefinition(deps, parsed, registryAliases);

  for (const alias of parsed.aliases) {
    deps.push({
      ...getDep(alias, true, registryAliases),
      depType: 'docker',
    });
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}

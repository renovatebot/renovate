import { isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { OrbDatasource } from '../../datasource/orb/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { CircleCiFile, type CircleCiOrb } from './schema.ts';

const functionReference = regEx(/^(?<name>[^@]+)@(?<currentValue>[^@]+)$/);
const githubFunctionName = regEx(/^github\.com\/(?<repo>[^/]+\/[^/]+)$/);

function getFunctionDep(key: string, reference: string): PackageDependency {
  const dep: PackageDependency = {
    depName: key,
    depType: 'function',
    datasource: GithubReleasesDatasource.id,
    versioning: semverVersioning.id,
    packageName: reference,
  };

  const groups = functionReference.exec(reference)?.groups;
  if (!groups) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }

  dep.packageName = groups.name;
  dep.currentValue = groups.currentValue;
  const repo = githubFunctionName.exec(groups.name)?.groups?.repo;
  if (!repo) {
    dep.skipReason = 'unsupported-url';
    return dep;
  }

  dep.packageName = repo;
  return dep;
}

function extractFunctions(
  deps: PackageDependency[],
  functions: Record<string, string>,
): void {
  for (const [key, reference] of Object.entries(functions)) {
    deps.push(getFunctionDep(key, reference));
  }
}

function extractDefinition(
  deps: PackageDependency[],
  definition: CircleCiOrb | CircleCiFile,
  registryAliases: Record<string, string>,
): void {
  for (const [key, orb] of Object.entries(definition.orbs)) {
    if (isString(orb)) {
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
    deps.push(getDep(dockerImage, { registryAliases, depType: 'docker' }));
  }
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  const { val: parsed, err } = Result.wrap(() =>
    // Parse as YAML 1.1 so anchor merge keys (`<<`) work, matching CircleCI's
    // own behavior. Under YAML 1.2 a mapping with multiple `<<` keys is
    // rejected as a duplicate key, which causes the whole file to be skipped.
    CircleCiFile.parse(parseSingleYaml(content, { version: '1.1' })),
  ).unwrap();

  if (err) {
    logger.debug({ err, packageFile }, 'Error extracting circleci images');
    return null;
  }

  const registryAliases = coerceObject(config?.registryAliases);
  const deps: PackageDependency[] = [];
  extractDefinition(deps, parsed, registryAliases);
  extractFunctions(deps, parsed.functions);

  for (const alias of parsed.aliases) {
    deps.push(getDep(alias, { registryAliases, depType: 'docker' }));
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}

import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { parseSingleYaml } from '../../../util/yaml';
import { GoDatasource } from '../../datasource/go';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { type Module, type OCBConfig, OCBConfigSchema } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): PackageFileContent | null {
  let definition: OCBConfig | null = null;
  try {
    const yaml = parseSingleYaml(content);
    const parsed = OCBConfigSchema.safeParse(yaml);
    if (!parsed.success) {
      logger.trace(
        { packageFile, error: parsed.error },
        'Failed to parse OCB schema',
      );
      return null;
    }

    definition = parsed.data;
  } catch (error) {
    logger.debug(
      { packageFile, error },
      'OCB manager failed to parse file as YAML',
    );
    return null;
  }

  const deps: PackageDependency[] = [];
  if (definition.dist.otelcol_version) {
    deps.push({
      datasource: GoDatasource.id,
      depType: 'collector',
      depName: 'go.opentelemetry.io/collector',
      currentValue: definition.dist.otelcol_version,
      extractVersion: '^v(?<version>\\S+)',
    });
  }

  deps.push(...processModule(definition.connectors, 'connectors'));
  deps.push(...processModule(definition.exporters, 'exports'));
  deps.push(...processModule(definition.extensions, 'extensions'));
  deps.push(...processModule(definition.processors, 'processors'));
  deps.push(...processModule(definition.receivers, 'receivers'));

  return {
    packageFileVersion: definition.dist.version,
    deps,
  };
}

export function processModule(
  module: Module,
  depType: string,
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  if (is.nullOrUndefined(module)) {
    return deps;
  }

  for (const element of module) {
    const [depName, currentValue] = element.gomod.trim().split(regEx(/\s+/));
    deps.push({
      datasource: GoDatasource.id,
      depType,
      depName,
      currentValue,
    });
  }

  return deps;
}

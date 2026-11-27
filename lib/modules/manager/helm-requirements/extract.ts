import { isArray } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { isAlias, parseRepository, resolveAlias } from '../helmv3/utils.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  let deps = [];
  // TODO: fix type
  let doc: any;
  try {
    doc = parseSingleYaml(content); // TODO #9610
  } catch {
    logger.debug({ packageFile }, `Failed to parse helm requirements.yaml`);
    return null;
  }
  if (!(doc && isArray(doc.dependencies))) {
    logger.debug({ packageFile }, `requirements.yaml has no dependencies`);
    return null;
  }
  deps = doc.dependencies.map((dep: Record<string, any>) => {
    let currentValue: string | undefined; // Remove when #9610 has been implemented
    switch (typeof dep.version) {
      case 'number':
        currentValue = String(dep.version);
        break;
      case 'string':
        currentValue = dep.version;
    }

    const res: PackageDependency = {
      depName: dep.name,
      currentValue,
    };

    if (!res.depName) {
      res.skipReason = 'invalid-name';
      return res;
    }

    if (!res.currentValue) {
      res.skipReason = 'invalid-version';
      return res;
    }

    if (!dep.repository) {
      res.skipReason = 'no-repository';
      return res;
    }

    res.registryUrls = [dep.repository];
    if (isAlias(dep.repository)) {
      const repository = resolveAlias(
        dep.repository,
        coerceObject(config.registryAliases),
      );
      if (!repository) {
        res.skipReason = 'placeholder-url';
        return res;
      }

      res.registryUrls = [repository];
      return res;
    }

    return { ...res, ...parseRepository(dep.name, dep.repository) };
  });
  const res = {
    deps,
    datasource: HelmDatasource.id,
  };
  return res;
}

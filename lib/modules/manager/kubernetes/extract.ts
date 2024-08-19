import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { parseYaml } from '../../../util/yaml';
import {
  KubernetesApiDatasource,
  supportedApis,
} from '../../datasource/kubernetes-api';
import * as kubernetesApiVersioning from '../../versioning/kubernetes-api';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { KubernetesConfiguration } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  logger.trace('kubernetes.extractPackageFile()');

  const isKubernetesManifest =
    regEx(/\s*apiVersion\s*:/).test(content) &&
    regEx(/\s*kind\s*:/).test(content);
  if (!isKubernetesManifest) {
    return null;
  }

  const deps: PackageDependency[] = [
    ...extractImages(content, config),
    ...extractApis(content, packageFile),
  ];

  return deps.length ? { deps } : null;
}

function extractImages(
  content: string,
  config: ExtractConfig,
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const line of content.split(newlineRegex)) {
    const match = regEx(/^\s*-?\s*image:\s*['"]?([^\s'"]+)['"]?\s*/).exec(line);
    if (match) {
      const currentFrom = match[1];
      const dep = getDep(currentFrom, true, config.registryAliases);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Kubernetes image',
      );
      deps.push(dep);
    }
  }

  return deps.filter((dep) => !dep.currentValue?.includes('${'));
}

function extractApis(
  content: string,
  packageFile: string,
): PackageDependency[] {
  let doc: KubernetesConfiguration[];

  try {
    // TODO: use schema (#9610)
    doc = parseYaml(content, {
      filename: packageFile,
      removeTemplates: true,
      json: true,
    });
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse Kubernetes manifest.');
    return [];
  }

  return doc
    .filter(is.truthy)
    .filter(
      (m) =>
        is.nonEmptyStringAndNotWhitespace(m.kind) &&
        is.nonEmptyStringAndNotWhitespace(m.apiVersion),
    )
    .filter((m) => supportedApis.has(m.kind))
    .map((configuration) => ({
      depName: configuration.kind,
      currentValue: configuration.apiVersion,
      datasource: KubernetesApiDatasource.id,
      versioning: kubernetesApiVersioning.id,
    }));
}

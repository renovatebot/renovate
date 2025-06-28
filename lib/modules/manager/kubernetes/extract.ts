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

// Comes from https://github.com/distribution/reference/blob/v0.6.0/regexp.go
// Extracted & converted with https://go.dev/play/p/KQQAONGp__2
const dockerImageRegexPattern = `((?:(?:(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])(?:\\.(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]))*|\\[(?:[a-fA-F0-9:]+)\\])(?::[0-9]+)?/)?[a-z0-9]+(?:(?:[._]|__|[-]+)[a-z0-9]+)*(?:/[a-z0-9]+(?:(?:[._]|__|[-]+)[a-z0-9]+)*)*)(?::([A-Za-z0-9_][A-Za-z0-9_.-]{0,127}))?(?:@([A-Za-z][A-Za-z0-9]*(?:[-_+.][A-Za-z][A-Za-z0-9]*)*[:][0-9a-fA-F]{32,}))?`;

const k8sImageRegex = regEx(
  `^\\s*-?\\s*image:\\s*['"]?(${dockerImageRegexPattern})['"]?\\s*`,
);

function extractImages(
  content: string,
  config: ExtractConfig,
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const line of content.split(newlineRegex)) {
    const match = k8sImageRegex.exec(line);
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

  return deps;
}

function extractApis(
  content: string,
  packageFile: string,
): PackageDependency[] {
  let doc: KubernetesConfiguration[];

  try {
    // TODO: use schema (#9610)
    doc = parseYaml(content, {
      removeTemplates: true,
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

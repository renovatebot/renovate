import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { withDebugMessage } from '../../../util/schema-utils/index.ts';
import {
  KubernetesApiDatasource,
  supportedApis,
} from '../../datasource/kubernetes-api/index.ts';
import * as kubernetesApiVersioning from '../../versioning/kubernetes-api/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { type KubernetesManifest, KubernetesManifests } from './schema.ts';

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

  const manifests = KubernetesManifests.catch(
    withDebugMessage([], `${packageFile} does not match Kubernetes schema`),
  ).parse(content);

  const deps: PackageDependency[] = [
    ...extractImages(content, config),
    ...extractApis(manifests),
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

function extractApis(manifests: KubernetesManifest[]): PackageDependency[] {
  return manifests
    .filter((m) => supportedApis.has(m.kind))
    .map((configuration) => ({
      depName: configuration.kind,
      currentValue: configuration.apiVersion,
      datasource: KubernetesApiDatasource.id,
      versioning: kubernetesApiVersioning.id,
    }));
}

import { isString } from '@sindresorhus/is';
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
import type { KubernetesExtractConfig } from './types.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: KubernetesExtractConfig,
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

  const imageDeps = extractImages(content, config);
  // Version label dependencies are re-extracted while their branch is updated,
  // even when the manager option is not part of the upgrade config.
  const isVersionLabelReExtract = config.digestManagedExternally === true;
  const isVersionLabelUpdate =
    config.updateAppVersionLabel === true || isVersionLabelReExtract;
  const deps: PackageDependency[] = [
    ...imageDeps,
    ...extractImageVolumes(manifests, config),
    ...(isVersionLabelUpdate
      ? extractVersionLabels(manifests, imageDeps, config)
      : []),
    ...extractApis(manifests),
  ];

  return deps.length ? { deps } : null;
}

function extractVersionLabels(
  manifests: KubernetesManifest[],
  imageDeps: PackageDependency[],
  config: KubernetesExtractConfig,
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  const { depName, currentValue, newValue } = config;

  for (const manifest of manifests) {
    // Only images of the same workload may own its version label
    const manifestImageDeps = imageDeps.filter(
      (dep) =>
        isString(dep.replaceString) &&
        manifest.containerImages.includes(dep.replaceString),
    );

    for (const versionLabel of manifest.versionLabels) {
      const isUpdatedValue =
        versionLabel === currentValue || versionLabel === newValue;
      const imageDep =
        manifestImageDeps.find((dep) => dep.currentValue === versionLabel) ??
        (isUpdatedValue
          ? manifestImageDeps.find((dep) => dep.depName === depName)
          : undefined);
      if (imageDep) {
        deps.push({
          ...imageDep,
          currentValue: versionLabel,
          pinDigests: false,
          digestManagedExternally: true,
          autoReplaceStringTemplate: '{{newValue}}',
          replaceString: versionLabel,
        });
      }
    }
  }

  return deps;
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
      const dep = getDep(currentFrom, {
        registryAliases: config.registryAliases,
      });
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

function extractImageVolumes(
  manifests: KubernetesManifest[],
  config: ExtractConfig,
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const manifest of manifests) {
    for (const currentFrom of manifest.imageVolumeReferences) {
      const dep = getDep(currentFrom, {
        registryAliases: config.registryAliases,
      });
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Kubernetes image volume',
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

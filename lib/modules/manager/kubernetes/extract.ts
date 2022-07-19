import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type { KubernetesConfiguration } from './types';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('kubernetes.extractPackageFile()');

  const isKubernetesManifest =
    regEx(/\s*apiVersion\s*:/).test(content) &&
    regEx(/\s*kind\s*:/).test(content);
  if (!isKubernetesManifest) {
    return null;
  }

  const deps: PackageDependency[] = [
    ...extractImages(content),
    ...extractApis(content),
  ];

  return deps.length ? { deps } : null;
}

function extractImages(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const line of content.split(newlineRegex)) {
    const match = regEx(/^\s*-?\s*image:\s*'?"?([^\s'"]+)'?"?\s*$/).exec(line);
    if (match) {
      const currentFrom = match[1];
      const dep = getDep(currentFrom);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Kubernetes image'
      );
      deps.push(dep);
    }
  }

  return deps.filter((dep) => !dep.currentValue?.includes('${'));
}

function extractApis(content: string): PackageDependency[] {
  let doc: KubernetesConfiguration[] | undefined;

  try {
    doc = loadAll(content) as KubernetesConfiguration[];
  } catch (err) {
    logger.debug({ err, content }, 'Failed to parse Kubernetes configuration.');
    return [];
  }

  return doc
    .filter(is.truthy)
    .filter(
      (m) =>
        is.nonEmptyStringAndNotWhitespace(m.kind) &&
        is.nonEmptyStringAndNotWhitespace(m.apiVersion)
    )
    .map((configuration) => ({
      depName: configuration.kind,
      currentValue: configuration.apiVersion,
    }));
}

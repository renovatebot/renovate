import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type { TektonBundle, TektonResource } from './types';

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace('tekton.extractPackageFile()');
  const deps: PackageDependency[] = [];
  let docs: any[];
  try {
    docs = loadAll(content) as TektonResource[];
  } catch (err) {
    logger.debug(
      { err, fileName },
      'Failed to parse YAML resource as a Tekton resource'
    );
    return null;
  }
  for (const doc of docs) {
    deps.push(...getDeps(doc));
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

function getDeps(doc: TektonResource): PackageDependency[] {
  const deps: PackageDependency[] = [];

  // Handle TaskRun resource
  addDep(doc?.spec?.taskRef, deps);

  // Handle PipelineRun resource
  addDep(doc?.spec?.pipelineRef, deps);

  // Handle Pipeline resource
  for (const task of doc?.spec?.tasks ?? []) {
    addDep(task?.taskRef, deps);
  }

  // Handle TriggerTemplate resource
  for (const resource of doc?.spec?.resourcetemplates ?? []) {
    addDep(resource?.spec?.taskRef, deps);
    addDep(resource?.spec?.pipelineRef, deps);
  }

  // Handle list of TektonResources
  const items = doc?.items ?? [];
  if (items.length > 0) {
    for (const item of doc?.items || []) {
      deps.push(...getDeps(item));
    }
  }

  return deps;
}

function addDep(ref: TektonBundle, deps: PackageDependency[]): void {
  let imageRef = '';
  // Find a bundle reference from the Bundle resolver
  if (ref?.resolver === 'bundles') {
    for (const field of ref?.resource ?? []) {
      if (field.name === 'bundle') {
        imageRef = field.value;
        break;
      }
    }
  }
  if (!is.string(imageRef) || is.emptyString(imageRef)) {
    // Fallback to older style bundle reference
    imageRef = ref?.bundle;
    if (!is.string(imageRef) || is.emptyString(imageRef)) {
      return;
    }
  }

  const dep = getDep(imageRef);
  // If a tag is not found, assume the lowest possible version. This will
  // ensure the version update is successful, and properly pin the digest.
  dep.currentValue = dep.currentValue ?? '0.0';
  dep.depType = 'tekton-bundle';
  logger.trace(
    {
      depName: dep.depName,
      currentValue: dep.currentValue,
      currentDigest: dep.currentDigest,
    },
    'Tekton bundle dependency found'
  );
  deps.push(dep);
}

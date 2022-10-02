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
  let docs: TektonResource[];
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
  if (is.falsy(doc)) {
    return deps;
  }

  // Handle TaskRun resource
  addDep(doc.spec?.taskRef, deps);

  // Handle PipelineRun resource
  addDep(doc.spec?.pipelineRef, deps);

  // Handle Pipeline resource
  for (const task of doc.spec?.tasks ?? []) {
    addDep(task.taskRef, deps);
  }

  // Handle TriggerTemplate resource
  for (const resource of doc.spec?.resourcetemplates ?? []) {
    addDep(resource?.spec?.taskRef, deps);
    addDep(resource?.spec?.pipelineRef, deps);
  }

  // Handle list of TektonResources
  for (const item of doc.items ?? []) {
    deps.push(...getDeps(item));
  }

  return deps;
}

function addDep(ref: TektonBundle, deps: PackageDependency[]): void {
  if (is.falsy(ref)) {
    return;
  }
  let imageRef: string | undefined;
  // Find a bundle reference from the Bundle resolver
  if (ref.resolver === 'bundles') {
    for (const field of ref.resource ?? []) {
      if (field.name === 'bundle') {
        imageRef = field.value;
        break;
      }
    }
  }

  if (is.nullOrUndefined(imageRef)) {
    // Fallback to older style bundle reference
    imageRef = ref.bundle;
  }

  const dep = getDep(imageRef);
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

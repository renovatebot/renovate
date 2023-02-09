import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type {
  TektonBundle,
  TektonResolverParamsField,
  TektonResource,
  TektonResourceSpec,
} from './types';

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
    deps.push(...getStepImageDeps(doc));
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

  // Handle PipelineRun resource with inline Pipeline definition
  const pipelineSpec = doc.spec?.pipelineSpec;
  if (is.truthy(pipelineSpec)) {
    deps.push(...getDeps({ spec: pipelineSpec }));
  }

  // Handle regular tasks of Pipeline resource
  for (const task of coerceArray(doc.spec?.tasks)) {
    addDep(task.taskRef, deps);
  }

  // Handle finally tasks of Pipeline resource
  for (const task of coerceArray(doc.spec?.finally)) {
    addDep(task.taskRef, deps);
  }

  // Handle TriggerTemplate resource
  for (const resource of coerceArray(doc.spec?.resourcetemplates)) {
    addDep(resource?.spec?.taskRef, deps);
    addDep(resource?.spec?.pipelineRef, deps);
  }

  // Handle list of TektonResources
  for (const item of coerceArray(doc.items)) {
    deps.push(...getDeps(item));
  }

  return deps;
}

function addDep(ref: TektonBundle, deps: PackageDependency[]): void {
  if (is.falsy(ref)) {
    return;
  }
  let imageRef: string | undefined;

  // First, find a bundle reference from the Bundle resolver
  if (ref.resolver === 'bundles') {
    imageRef = getBundleValue(ref.params);
    if (is.nullOrUndefined(imageRef)) {
      // Fallback to the deprecated Bundle resolver attribute
      imageRef = getBundleValue(ref.resource);
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

function getStepImageDeps(doc: TektonResource): PackageDependency[] {
  const deps: PackageDependency[] = [];
  if (is.falsy(doc)) {
    return deps;
  }

  // Handle list of TektonResources
  for (const item of coerceArray(doc.items)) {
    deps.push(...getStepImageDeps(item));
  }

  // Handle TriggerTemplate resource
  for (const resource of coerceArray(doc.spec?.resourcetemplates)) {
    deps.push(...getStepImageDeps(resource));
  }

  // Handle Task resource
  addStepImageSpec(doc.spec, deps);

  // Handle TaskRun resource
  addStepImageSpec(doc.spec?.taskSpec, deps);

  // Handle Pipeline resource
  for (const task of coerceArray(doc.spec?.tasks)) {
    addStepImageSpec(task.taskSpec, deps);
  }
  for (const task of coerceArray(doc.spec?.finally)) {
    addStepImageSpec(task.taskSpec, deps);
  }

  // Handle PipelineRun resource
  for (const task of coerceArray(doc.spec?.pipelineSpec?.tasks)) {
    addStepImageSpec(task.taskSpec, deps);
  }
  for (const task of coerceArray(doc.spec?.pipelineSpec?.finally)) {
    addStepImageSpec(task.taskSpec, deps);
  }

  return deps;
}

function addStepImageSpec(
  spec: TektonResourceSpec | undefined,
  deps: PackageDependency[]
): void {
  if (is.nullOrUndefined(spec)) {
    return;
  }

  const steps = [
    ...coerceArray(spec.steps),
    ...coerceArray(spec.sidecars),
    spec.stepTemplate,
  ];
  for (const step of steps) {
    if (is.nullOrUndefined(step?.image)) {
      continue;
    }
    const dep = getDep(step?.image);
    dep.depType = 'tekton-step-image';
    logger.trace(
      {
        depName: dep.depName,
        currentValue: dep.currentValue,
        currentDigest: dep.currentDigest,
      },
      'Tekton step image dependency found'
    );
    deps.push(dep);
  }
}

function getBundleValue(
  fields: TektonResolverParamsField[] | undefined
): string | undefined {
  for (const field of coerceArray(fields)) {
    if (field.name === 'bundle') {
      return field.value;
    }
  }
  return undefined;
}

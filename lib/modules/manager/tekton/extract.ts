import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';
import type {
  TektonBundle,
  TektonResolverParamsField,
  TektonResource,
  TektonResourceSpec,
} from './types';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`tekton.extractPackageFile(${packageFile})`);
  const deps: PackageDependency[] = [];
  let docs: TektonResource[];
  try {
    docs = loadAll(content) as TektonResource[];
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse YAML resource as a Tekton resource',
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
  addStepImageSpec(doc.spec?.taskSpec, deps);

  // Handle Task resource
  addStepImageSpec(doc.spec, deps);

  // Handle PipelineRun resource
  addDep(doc.spec?.pipelineRef, deps);

  // Handle PipelineRun resource with inline Pipeline definition
  const pipelineSpec = doc.spec?.pipelineSpec;
  if (is.truthy(pipelineSpec)) {
    deps.push(...getDeps({ spec: pipelineSpec }));
  }

  // Handle regular tasks of Pipeline resource
  for (const task of [
    ...coerceArray(doc.spec?.tasks),
    ...coerceArray(doc.spec?.finally),
  ]) {
    addDep(task.taskRef, deps);
    addStepImageSpec(task.taskSpec, deps);
  }

  // Handle TriggerTemplate resource
  for (const resource of coerceArray(doc.spec?.resourcetemplates)) {
    deps.push(...getDeps(resource));
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
    'Tekton bundle dependency found',
  );
  deps.push(dep);
}

function addStepImageSpec(
  spec: TektonResourceSpec | undefined,
  deps: PackageDependency[],
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
      'Tekton step image dependency found',
    );
    deps.push(dep);
  }
}

function getBundleValue(
  fields: TektonResolverParamsField[] | undefined,
): string | undefined {
  for (const field of coerceArray(fields)) {
    if (field.name === 'bundle') {
      return field.value;
    }
  }
  return undefined;
}

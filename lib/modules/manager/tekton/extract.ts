import { isFalsy, isNullOrUndefined, isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { TektonDepType } from './dep-types.ts';
import type {
  TektonBundle,
  TektonResolverParamsField,
  TektonResource,
  TektonResourceSpec,
} from './types.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`tekton.extractPackageFile(${packageFile})`);
  const deps: PackageDependency<Record<string, any>, TektonDepType>[] = [];
  let docs: TektonResource[];
  try {
    // TODO: use schema (#9610)
    docs = parseYaml(content);
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

function getDeps(
  doc: TektonResource,
): PackageDependency<Record<string, any>, TektonDepType>[] {
  const deps: PackageDependency<Record<string, any>, TektonDepType>[] = [];
  if (isFalsy(doc)) {
    return deps;
  }

  // Handle TaskRun resource
  addDep(doc.spec?.taskRef, deps);
  addStepImageSpec(doc.spec?.taskSpec, deps);

  // Handle Task resource
  addStepImageSpec(doc.spec, deps);

  // Handle PipelineRun resource
  addDep(doc.spec?.pipelineRef, deps);

  addPipelineAsCodeAnnotations(doc.metadata?.annotations, deps);

  // Handle PipelineRun resource with inline Pipeline definition
  const pipelineSpec = doc.spec?.pipelineSpec;
  if (isTruthy(pipelineSpec)) {
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

const annotationRegex = regEx(
  /^pipelinesascode\.tekton\.dev\/(?:task(-[0-9]+)?|pipeline)$/,
);

function addPipelineAsCodeAnnotations(
  annotations: Record<string, string> | undefined | null,
  deps: PackageDependency<Record<string, any>, TektonDepType>[],
): void {
  if (isNullOrUndefined(annotations)) {
    return;
  }

  for (const [key, value] of Object.entries(annotations)) {
    if (!annotationRegex.test(key)) {
      continue;
    }

    const values = value
      .replace(regEx(/]$/), '')
      .replace(regEx(/^\[/), '')
      .split(',');
    for (const value of values) {
      const dep = getAnnotationDep(value.trim());
      if (!dep) {
        continue;
      }
      deps.push(dep);
    }
  }
}

const githubRelease = regEx(
  /^(?<url>(?:(?:http|https):\/\/)?(?<path>(?:[^:/\s]+[:/])?(?<project>[^/\s]+\/[^/\s]+)))\/releases\/download\/(?<currentValue>.+)\/(?<subdir>[^?\s]*)$/,
);

const gitUrl = regEx(
  /^(?<url>(?:(?:http|https):\/\/)?(?<path>(?:[^:/\s]+[:/])?(?<project>[^/\s]+\/[^/\s]+)))(?:\/raw)?\/(?<currentValue>.+?)\/(?<subdir>[^?\s]*)$/,
);

function getAnnotationDep(
  url: string,
): PackageDependency<Record<string, any>, TektonDepType> | null {
  const dep: PackageDependency<Record<string, any>, TektonDepType> = {
    depType: 'tekton-annotation',
  };

  let groups = githubRelease.exec(url)?.groups;

  if (groups) {
    dep.datasource = GithubReleasesDatasource.id;

    dep.depName = groups.path;
    dep.packageName = groups.project;
    dep.currentValue = groups.currentValue;
    return dep;
  }

  groups = gitUrl.exec(url)?.groups;
  if (groups) {
    dep.datasource = GitTagsDatasource.id;

    dep.depName = groups.path.replace(
      'raw.githubusercontent.com',
      'github.com',
    );
    dep.packageName = groups.url.replace(
      'raw.githubusercontent.com',
      'github.com',
    );
    dep.currentValue = groups.currentValue;
    return dep;
  }

  return null;
}

function addDep(
  ref: TektonBundle,
  deps: PackageDependency<Record<string, any>, TektonDepType>[],
): void {
  if (isFalsy(ref)) {
    return;
  }
  let imageRef: string | undefined;

  // First, find a bundle reference from the Bundle resolver
  if (ref.resolver === 'bundles') {
    imageRef = getBundleValue(ref.params);
    if (isNullOrUndefined(imageRef)) {
      // Fallback to the deprecated Bundle resolver attribute
      imageRef = getBundleValue(ref.resource);
    }
  }

  if (isNullOrUndefined(imageRef)) {
    // Fallback to older style bundle reference
    imageRef = ref.bundle;
  }

  const baseDep = getDep(imageRef);
  const dep = { ...baseDep, depType: 'tekton-bundle' as const };
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
  deps: PackageDependency<Record<string, any>, TektonDepType>[],
): void {
  if (isNullOrUndefined(spec)) {
    return;
  }

  const steps = [
    ...coerceArray(spec.steps),
    ...coerceArray(spec.sidecars),
    spec.stepTemplate,
  ];
  for (const step of steps) {
    if (isNullOrUndefined(step?.image)) {
      continue;
    }
    const baseDep = getDep(step?.image);
    const dep = { ...baseDep, depType: 'tekton-step-image' as const };
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

import is from '@sindresorhus/is';
import { BitriseDatasource } from '../../datasource/bitrise';
import { GitTagsDatasource } from '../../datasource/git-tags';
import type { PackageDependency } from '../types';

export function parseStep(
  stepRef: string,
  defaultRegistry?: string,
): PackageDependency | null {
  if (is.emptyString(stepRef)) {
    return null;
  }

  const dep: PackageDependency = {
    datasource: BitriseDatasource.id,
    replaceString: stepRef,
  };

  const [ref, currentValue] = stepRef.split('@', 2);

  const refDep = parseStepRef(ref, defaultRegistry);

  // no version
  if (is.nullOrUndefined(currentValue)) {
    return {
      ...dep,
      packageName: stepRef,
      skipReason: 'unspecified-version',
    };
  }

  return {
    ...dep,
    ...refDep,
    currentValue,
  };
}

export function parseStepRef(
  ref: string,
  defaultRegistry?: string,
): PackageDependency {
  // handle local path
  // https://devcenter.bitrise.io/en/references/steps-reference/step-reference-id-format.html
  if (ref.startsWith('path::')) {
    return {
      depName: ref.split('::', 2)[1],
      skipReason: 'local-dependency',
    };
  }

  // handle Git references
  // https://devcenter.bitrise.io/en/references/steps-reference/step-reference-id-format.html
  if (ref.startsWith('git::')) {
    const [, packageName] = ref.split('::');
    return {
      packageName,
      datasource: GitTagsDatasource.id,
    };
  }

  // step library references
  // https://devcenter.bitrise.io/en/references/steps-reference/step-reference-id-format.html
  const splitted = ref.split('::', 2);

  // reference which uses default registry
  // - script:
  if (splitted.length === 1) {
    const [packageName] = splitted;
    return {
      packageName,
      datasource: BitriseDatasource.id,
      registryUrls: defaultRegistry ? [defaultRegistry] : undefined,
    };
  }

  // reference which overwrites Bitrise registry
  // https://github.com/bitrise-io/bitrise-steplib.git::script@1:
  const [registryUrl, packageName] = splitted;
  return {
    packageName,
    datasource: BitriseDatasource.id,
    registryUrls: [registryUrl],
  };
}

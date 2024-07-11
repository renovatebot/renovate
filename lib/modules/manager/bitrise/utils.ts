import is from '@sindresorhus/is';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import type { PackageDependency } from '../types';

const stepsWithOldNamingScheme: string[] = [
  "share-pipeline-variable",
  "restore-gradle-cache",
  "restore-cache",
  "set-java-version",
  "pull-intermediate-files",
  "save-gradle-cache",
  "save-cache",
  "s3-download",
  "slack",
  "build-router-start"
]

export function parseStep(stepRef: string): PackageDependency | null {
  if (is.emptyString(stepRef)) {
    return null;
  }

  const dep: PackageDependency = {
    datasource: GithubReleasesDatasource.id,
    replaceString: stepRef
  }

  const splitted = stepRef.split('@');

  // no version
  if (splitted.length === 1) {
    return {
      ...dep,
      depName: stepRef,
      skipReason: 'unspecified-version',
      packageName: createPackageName(stepRef)
    }
  }

  // too many @ chars
  if (splitted.length > 2) {
    return {
      ...dep,
      depName: stepRef,
      skipReason: 'invalid-value',
      packageName: createPackageName(stepRef)
    }
  }

  const [depName, currentValue] = splitted;
  return {
    ...dep,
    depName,
    currentValue,
    packageName: createPackageName(depName),
  }
}

function createPackageName(stepName: string): string {
  if (stepsWithOldNamingScheme.includes(stepName)) {
    return `bitrise-steplib/bitrise-steps-${stepName}`
  }
    return `bitrise-steplib/steps-${stepName}`
}

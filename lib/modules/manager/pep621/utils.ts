import { isNonEmptyString, isNullOrUndefined } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { normalizePythonDepName } from '../../datasource/pypi/common.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { api as pythonVersioning } from '../../versioning/python/index.ts';
import type { ExtractConfig, PackageDependency } from '../types.ts';
import type { Pep508ParseResult, Pep621ManagerData } from './types.ts';

const pep508Regex = regEx(
  /^(?<packageName>[A-Z0-9._-]+)\s*(\[(?<extras>[A-Z0-9\s,._-]+)\])?\s*(?<currentValue>[^;]+)?(;\s*(?<marker>.*))?/i,
);

export const depTypes = {
  dependencies: 'project.dependencies',
  optionalDependencies: 'project.optional-dependencies',
  dependencyGroups: 'dependency-groups',
  pdmDevDependencies: 'tool.pdm.dev-dependencies',
  uvDevDependencies: 'tool.uv.dev-dependencies',
  uvSources: 'tool.uv.sources',
  buildSystemRequires: 'build-system.requires',
};

export function parsePEP508(
  value: string | null | undefined,
): Pep508ParseResult | null {
  if (isNullOrUndefined(value)) {
    return null;
  }

  const regExpExec = pep508Regex.exec(value);
  if (isNullOrUndefined(regExpExec) || isNullOrUndefined(regExpExec?.groups)) {
    logger.trace(`Pep508 could not be extracted`);
    return null;
  }

  const result: Pep508ParseResult = {
    packageName: regExpExec.groups.packageName,
  };
  if (isNonEmptyString(regExpExec.groups.currentValue)) {
    if (
      regExpExec.groups.currentValue.startsWith('(') &&
      regExpExec.groups.currentValue.endsWith(')')
    ) {
      result.currentValue = regExpExec.groups.currentValue.slice(1, -1).trim();
    } else {
      result.currentValue = regExpExec.groups.currentValue;
    }
  }

  if (isNonEmptyString(regExpExec.groups.marker)) {
    result.marker = regExpExec.groups.marker;
  }
  if (isNonEmptyString(regExpExec.groups.extras)) {
    // trim to remove allowed whitespace between brackets
    result.extras = regExpExec.groups.extras.split(',').map((e) => e.trim());
  }

  return result;
}

export function pep508ToPackageDependency(
  depType: string,
  value: string,
): PackageDependency | null {
  const parsed = parsePEP508(value);
  if (isNullOrUndefined(parsed)) {
    return null;
  }

  const dep: PackageDependency = {
    packageName: normalizePythonDepName(parsed.packageName),
    depName: parsed.packageName,
    datasource: PypiDatasource.id,
    depType,
  };

  if (parsed.marker) {
    dep.managerData = {
      marker: parsed.marker,
      pep508String: value,
    } satisfies Pep621ManagerData;
  }

  if (isNullOrUndefined(parsed.currentValue)) {
    dep.skipReason = 'unspecified-version';
  } else {
    dep.currentValue = parsed.currentValue;

    if (parsed.currentValue.startsWith('==')) {
      dep.currentVersion = parsed.currentValue.replace(regEx(/^==\s*/), '');
    }
  }
  return dep;
}

const pythonMarkerRegex = regEx(
  /^python_(?:full_)?version\s*(~=|>=|<=|==|!=|<|>)\s*['"]([^'"]+)['"]\s*$/,
);

export function extractPythonConstraintFromMarker(
  marker: string,
): string | null {
  if (marker.includes(' and ') || marker.includes(' or ')) {
    return null;
  }
  const match = pythonMarkerRegex.exec(marker);
  if (!match) {
    return null;
  }
  return `${match[1]}${match[2]}`;
}

export function pythonConstraintToMarkerSlug(constraint: string): string {
  const operatorMatch = regEx(/^(~=|>=|<=|==|!=|<|>)(.+)$/).exec(constraint);
  if (!operatorMatch) {
    return 'py';
  }
  const operator = operatorMatch[1];
  const version = operatorMatch[2].replace(regEx(/[.*]/g), '');

  let prefix = '';
  let suffix = '';
  switch (operator) {
    case '>=':
      suffix = 'plus';
      break;
    case '==':
      break;
    case '<':
      prefix = 'lt';
      break;
    case '>':
      suffix = 'gt';
      break;
    case '<=':
      prefix = 'lte';
      break;
    case '!=':
      prefix = 'ne';
      break;
    case '~=':
      prefix = 'compat';
      break;
    default:
      prefix = '';
      break;
  }

  return `py${prefix}${version}${suffix}`;
}

interface MarkerManagerData {
  marker?: string;
  pep508String?: string;
}

function normalizePythonConstraintForFiltering(constraint: string): string {
  return constraint.startsWith('==') ? constraint.slice(2) : constraint;
}

function intersectPythonConstraints(
  projectConstraint: string | undefined,
  markerConstraint: string,
): string {
  if (!projectConstraint) {
    return normalizePythonConstraintForFiltering(markerConstraint);
  }

  const normalizedProjectConstraint = projectConstraint.trim();
  const normalizedMarkerConstraint = markerConstraint.trim();
  const markerExactVersion = normalizedMarkerConstraint.startsWith('==')
    ? normalizedMarkerConstraint.slice(2)
    : null;
  if (markerExactVersion) {
    if (
      pythonVersioning.matches(markerExactVersion, normalizedProjectConstraint)
    ) {
      return markerExactVersion;
    }
    return `${normalizedProjectConstraint},${normalizedMarkerConstraint}`;
  }

  const projectExactVersion = normalizedProjectConstraint.startsWith('==')
    ? normalizedProjectConstraint.slice(2)
    : null;
  if (projectExactVersion) {
    if (
      pythonVersioning.matches(projectExactVersion, normalizedMarkerConstraint)
    ) {
      return projectExactVersion;
    }
    return `${normalizedProjectConstraint},${normalizedMarkerConstraint}`;
  }

  if (
    pythonVersioning.subset?.(
      normalizedMarkerConstraint,
      normalizedProjectConstraint,
    )
  ) {
    return normalizedMarkerConstraint;
  }
  if (
    pythonVersioning.subset?.(
      normalizedProjectConstraint,
      normalizedMarkerConstraint,
    )
  ) {
    return normalizedProjectConstraint;
  }

  return `${normalizedProjectConstraint},${normalizedMarkerConstraint}`;
}

export function applySplitPythonMarkers(
  deps: PackageDependency[],
  config?: ExtractConfig,
  packageFilePythonConstraint?: string,
): PackageDependency[] {
  if (!config?.splitPythonMarkers) {
    return deps;
  }

  for (const dep of deps) {
    const managerData = dep.managerData as MarkerManagerData | undefined;
    const marker = managerData?.marker;
    if (!marker) {
      continue;
    }

    const markerConstraint = extractPythonConstraintFromMarker(marker);
    if (!markerConstraint) {
      continue;
    }

    const slug = pythonConstraintToMarkerSlug(markerConstraint);
    const constraintValue = intersectPythonConstraints(
      dep.constraints?.python ?? packageFilePythonConstraint,
      markerConstraint,
    );
    if (managerData?.pep508String) {
      dep.replaceString = managerData.pep508String;
    }
    dep.constraints = { ...dep.constraints, python: constraintValue };
    dep.constraintsFiltering = 'strict';
    dep.additionalBranchPrefix = `${slug}-`;
    dep.commitMessageSuffix = `(python ${markerConstraint})`;
    if (
      dep.currentValue?.startsWith('==') &&
      dep.currentVersion &&
      dep.lockedVersion
    ) {
      dep.lockedVersion = dep.currentVersion;
    }
  }

  return deps;
}

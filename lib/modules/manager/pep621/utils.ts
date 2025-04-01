import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { massage as massageToml, parse as parseToml } from '../../../util/toml';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import type { PackageDependency } from '../types';
import type { PyProject } from './schema';
import { PyProjectSchema } from './schema';
import type { Pep508ParseResult, Pep621ManagerData } from './types';

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
  if (is.nullOrUndefined(value)) {
    return null;
  }

  const regExpExec = pep508Regex.exec(value);
  if (
    is.nullOrUndefined(regExpExec) ||
    is.nullOrUndefined(regExpExec?.groups)
  ) {
    logger.trace(`Pep508 could not be extracted`);
    return null;
  }

  const result: Pep508ParseResult = {
    packageName: regExpExec.groups.packageName,
  };
  if (is.nonEmptyString(regExpExec.groups.currentValue)) {
    if (
      regExpExec.groups.currentValue.startsWith('(') &&
      regExpExec.groups.currentValue.endsWith(')')
    ) {
      result.currentValue = regExpExec.groups.currentValue.slice(1, -1).trim();
    } else {
      result.currentValue = regExpExec.groups.currentValue;
    }
  }

  if (is.nonEmptyString(regExpExec.groups.marker)) {
    result.marker = regExpExec.groups.marker;
  }
  if (is.nonEmptyString(regExpExec.groups.extras)) {
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
  if (is.nullOrUndefined(parsed)) {
    return null;
  }

  const dep: PackageDependency = {
    packageName: normalizePythonDepName(parsed.packageName),
    depName: parsed.packageName,
    datasource: PypiDatasource.id,
    depType,
  };

  if (is.nullOrUndefined(parsed.currentValue)) {
    dep.skipReason = 'unspecified-version';
  } else {
    dep.currentValue = parsed.currentValue;

    if (parsed.currentValue.startsWith('==')) {
      dep.currentVersion = parsed.currentValue.replace(regEx(/^==\s*/), '');
    }
  }
  return dep;
}

export function parseDependencyGroupRecord(
  depType: string,
  records: Record<string, string[]> | null | undefined,
): PackageDependency[] {
  if (is.nullOrUndefined(records)) {
    return [];
  }

  const deps: PackageDependency<Pep621ManagerData>[] = [];
  for (const [depGroup, pep508Strings] of Object.entries(records)) {
    for (const dep of parseDependencyList(depType, pep508Strings)) {
      deps.push({
        ...dep,
        depName: dep.packageName!,
        managerData: { depGroup },
      });
    }
  }
  return deps;
}

export function parseDependencyList(
  depType: string,
  list: string[] | null | undefined,
): PackageDependency[] {
  if (is.nullOrUndefined(list)) {
    return [];
  }

  const deps: PackageDependency[] = [];
  for (const element of list) {
    const dep = pep508ToPackageDependency(depType, element);
    if (is.truthy(dep)) {
      deps.push(dep);
    }
  }
  return deps;
}

export function parsePyProject(
  packageFile: string,
  content: string,
): PyProject | null {
  try {
    const jsonMap = parseToml(massageToml(content));
    return PyProjectSchema.parse(jsonMap);
  } catch (err) {
    logger.debug(
      { packageFile, err },
      `Failed to parse and validate pyproject file`,
    );
    return null;
  }
}

import { BuildDependency } from './gradle-updates-report';

/**
 * Functions adapted/ported from https://github.com/patrikerdes/gradle-use-latest-versions-plugin
 * gradle-use-latest-versions-plugin is licensed under MIT and Copyright (c) 2018 Patrik Erdes
 */

let variables: Record<string, string> = {};

// TODO: Unify with BuildDependency ?
export interface GradleDependency {
  group: string;
  name: string;
  version?: string;
}

interface UpdateFunction {
  (
    dependency: GradleDependency,
    buildGradleContent: string,
    newVersion: string
  ): string;
}

export function updateGradleVersion(
  buildGradleContent: string,
  dependency: GradleDependency,
  newVersion: string
) {
  if (dependency) {
    const updateFunctions: UpdateFunction[] = [
      updateVersionStringFormat,
      updateVersionMapFormat,
      updateVersionMapVariableFormat,
      updateVersionStringVariableFormat,
      updateVersionExpressionVariableFormat,
      updateGlobalVariables,
      updatePropertyFileGlobalVariables,
    ];

    // eslint-disable-next-line guard-for-in
    for (const updateFunctionIndex in updateFunctions) {
      const updateFunction = updateFunctions[updateFunctionIndex];
      const gradleContentUpdated = updateFunction(
        dependency,
        buildGradleContent,
        newVersion
      );
      if (gradleContentUpdated) {
        return gradleContentUpdated;
      }
    }
  }
  return buildGradleContent;
}

export function collectVersionVariables(
  dependencies: BuildDependency[],
  buildGradleContent: string
) {
  for (const dep of dependencies) {
    const dependency: GradleDependency = {
      ...dep,
      group: dep.depGroup,
    };
    const regexes = [
      moduleStringVariableExpressionVersionFormatMatch(dependency),
      moduleStringVariableInterpolationVersionFormatMatch(dependency),
      moduleMapVariableVersionFormatMatch(dependency),
    ];

    for (const regex of regexes) {
      const match = buildGradleContent.match(regex);
      if (match) {
        variables[`${dependency.group}:${dependency.name}`] = match[1];
      }
    }
  }
}

export function init() {
  variables = {};
}

function updateVersionStringFormat(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
) {
  const regex = moduleStringVersionFormatMatch(dependency);
  if (buildGradleContent.match(regex)) {
    return buildGradleContent.replace(regex, `$1${newVersion}$2`);
  }
  return null;
}

function updateVersionMapFormat(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
) {
  const regex = moduleMapVersionFormatMatch(dependency);
  if (buildGradleContent.match(regex)) {
    return buildGradleContent.replace(regex, `$1${newVersion}$2`);
  }
  return null;
}

function updateVersionMapVariableFormat(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
) {
  const regex = moduleMapVariableVersionFormatMatch(dependency);
  const match = buildGradleContent.match(regex);
  if (match) {
    return buildGradleContent.replace(
      variableDefinitionFormatMatch(match[1]),
      `$1${newVersion}$3`
    );
  }
  return null;
}

function updateVersionStringVariableFormat(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
) {
  const regex = moduleStringVariableInterpolationVersionFormatMatch(dependency);
  const match = buildGradleContent.match(regex);
  if (match) {
    return buildGradleContent.replace(
      variableDefinitionFormatMatch(match[1]),
      `$1${newVersion}$3`
    );
  }
  return null;
}

function updateVersionExpressionVariableFormat(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
) {
  const regex = moduleStringVariableExpressionVersionFormatMatch(dependency);
  const match = buildGradleContent.match(regex);
  if (match) {
    return buildGradleContent.replace(
      variableDefinitionFormatMatch(match[1]),
      `$1${newVersion}$3`
    );
  }
  return null;
}

function updateGlobalVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
) {
  const variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    const regex = variableDefinitionFormatMatch(variable);
    const match = buildGradleContent.match(regex);
    if (match) {
      return buildGradleContent.replace(
        variableDefinitionFormatMatch(variable),
        `$1${newVersion}$3`
      );
    }
  }
  return null;
}

function updatePropertyFileGlobalVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
) {
  const variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    const regex = new RegExp(`(${variable}\\s*=\\s*)(.*)`);
    const match = buildGradleContent.match(regex);
    if (match) {
      return buildGradleContent.replace(regex, `$1${newVersion}`);
    }
  }
  return null;
}

// https://github.com/patrikerdes/gradle-use-latest-versions-plugin/blob/8cf9c3917b8b04ba41038923cab270d2adda3aa6/src/main/groovy/se/patrikerdes/DependencyUpdate.groovy#L27-L29
function moduleStringVersionFormatMatch(dependency: GradleDependency) {
  return new RegExp(
    `(["']${dependency.group}:${dependency.name}:)[^$].*?(([:@].*?)?["'])`
  );
}

function moduleMapVersionFormatMatch(dependency: GradleDependency) {
  // prettier-ignore
  return new RegExp(
    `(group\\s*:\\s*["']${dependency.group}["']\\s*,\\s*` +
    `name\\s*:\\s*["']${dependency.name}["']\\s*,\\s*` +
    `version\\s*:\\s*["']).*?(["'])`
  );
}

function moduleMapVariableVersionFormatMatch(dependency: GradleDependency) {
  // prettier-ignore
  return new RegExp(
    `group\\s*:\\s*["']${dependency.group}["']\\s*,\\s*` +
    `name\\s*:\\s*["']${dependency.name}["']\\s*,\\s*` +
    `version\\s*:\\s*([^\\s"']+?)\\s`
  );
}

function moduleStringVariableInterpolationVersionFormatMatch(
  dependency: GradleDependency
) {
  return new RegExp(
    `["']${dependency.group}:${dependency.name}:\\$([^{].*?)["']`
  );
}

function moduleStringVariableExpressionVersionFormatMatch(
  dependency: GradleDependency
) {
  return new RegExp(
    `["']${dependency.group}:${dependency.name}:\\$\{([^{].*?)}["']`
  );
}

function variableDefinitionFormatMatch(variable: string) {
  return new RegExp(`(${variable}\\s*=\\s*?["'])(.*)(["'])`);
}

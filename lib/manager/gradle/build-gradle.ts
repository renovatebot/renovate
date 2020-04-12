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

const groovyQuotes = `(?:["'](?:""|'')?)`;

// https://github.com/patrikerdes/gradle-use-latest-versions-plugin/blob/8cf9c3917b8b04ba41038923cab270d2adda3aa6/src/main/groovy/se/patrikerdes/DependencyUpdate.groovy#L27-L29
function moduleStringVersionFormatMatch(dependency: GradleDependency): RegExp {
  return new RegExp(
    `(${groovyQuotes}${dependency.group}:${dependency.name}:)[^$].*?(([:@].*?)?${groovyQuotes})`
  );
}

function groovyPluginStringVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return new RegExp(
    `(id\\s+${groovyQuotes}${dependency.group}${groovyQuotes}\\s+version\\s+${groovyQuotes})[^$].*?(${groovyQuotes})`
  );
}

function kotlinPluginStringVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return new RegExp(
    `(id\\("${dependency.group}"\\)\\s+version\\s+")[^$].*?(")`
  );
}

function allMapFormatOrders(
  group: string,
  name: string,
  version: string,
  prefix: string,
  postfix: string
): RegExp[] {
  const comma = '\\s*,\\s*';
  return [
    `${group}${comma}${name}${comma}${version}`,
    `${group}${comma}${version}${comma}${name}`,
    `${name}${comma}${group}${comma}${version}`,
    `${version}${comma}${group}${comma}${name}`,
    `${name}${comma}${version}${comma}${group}`,
    `${version}${comma}${name}${comma}${group}`,
  ].map((regex) => new RegExp(`${prefix}${regex}${postfix}`));
}

function moduleMapVersionFormatMatch(dependency: GradleDependency): RegExp[] {
  // two captures groups: start and end. The version is in between them
  const group = `group\\s*:\\s*${groovyQuotes}${dependency.group}${groovyQuotes}`;
  const name = `name\\s*:\\s*${groovyQuotes}${dependency.name}${groovyQuotes}`;
  const version = `version\\s*:\\s*${groovyQuotes})[^{}$"']+?(${groovyQuotes}`;
  return allMapFormatOrders(group, name, version, '(', ')');
}

function moduleKotlinNamedArgumentVersionFormatMatch(
  dependency: GradleDependency
): RegExp[] {
  // two captures groups: start and end. The version is in between them
  const group = `group\\s*=\\s*"${dependency.group}"`;
  const name = `name\\s*=\\s*"${dependency.name}"`;
  const version = `version\\s*=\\s*")[^{}$]*?("`;
  return allMapFormatOrders(group, name, version, '(', ')');
}

function moduleMapVariableVersionFormatMatch(
  dependency: GradleDependency
): RegExp[] {
  // one capture group: the version variable
  const group = `group\\s*:\\s*${groovyQuotes}${dependency.group}${groovyQuotes}`;
  const name = `name\\s*:\\s*${groovyQuotes}${dependency.name}${groovyQuotes}`;
  const version = `version\\s*:\\s*(?:${groovyQuotes}\\$)?{?([^\\s"'{}$)]+)}?${groovyQuotes}?`;
  return allMapFormatOrders(group, name, version, '', '');
}

function moduleKotlinNamedArgumentVariableVersionFormatMatch(
  dependency: GradleDependency
): RegExp[] {
  // one capture group: the version variable
  const group = `group\\s*=\\s*"${dependency.group}"`;
  const name = `name\\s*=\\s*"${dependency.name}"`;
  const version = `version\\s*=\\s*(?:"\\$)?{?([^\\s"{}$]+?)}?"?`;
  return allMapFormatOrders(group, name, version, '', '[\\s),]');
}

function moduleStringVariableInterpolationVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return new RegExp(
    `${groovyQuotes}${dependency.group}:${dependency.name}:\\$([^{].*?)${groovyQuotes}`
  );
}

function moduleStringVariableExpressionVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return new RegExp(
    `${groovyQuotes}${dependency.group}:${dependency.name}:\\$` +
      `{([^{].*?)}${groovyQuotes}`
  );
}

function variableDefinitionFormatMatch(variable: string): RegExp {
  return new RegExp(`(${variable}\\s*=\\s*?["'])(.*)(["'])`);
}

function variableMapDefinitionFormatMatch(
  variable: string,
  version: string
): RegExp {
  return new RegExp(`(${variable}\\s*:\\s*?["'])(${version})(["'])`);
}

export function collectVersionVariables(
  dependencies: BuildDependency[],
  buildGradleContent: string
): void {
  for (const dep of dependencies) {
    const dependency: GradleDependency = {
      ...dep,
      group: dep.depGroup,
    };
    const regexes = [
      moduleStringVariableExpressionVersionFormatMatch(dependency),
      moduleStringVariableInterpolationVersionFormatMatch(dependency),
      ...moduleMapVariableVersionFormatMatch(dependency),
      ...moduleKotlinNamedArgumentVariableVersionFormatMatch(dependency),
    ];

    for (const regex of regexes) {
      const match = regex.exec(buildGradleContent);
      if (match) {
        variables[`${dependency.group}:${dependency.name}`] = match[1];
      }
    }
  }
}

export function init(): void {
  variables = {};
}

function updateVersionLiterals(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
): string | null {
  const regexes: RegExp[] = [
    moduleStringVersionFormatMatch(dependency),
    groovyPluginStringVersionFormatMatch(dependency),
    kotlinPluginStringVersionFormatMatch(dependency),
    ...moduleMapVersionFormatMatch(dependency),
    ...moduleKotlinNamedArgumentVersionFormatMatch(dependency),
  ];
  for (const regex of regexes) {
    if (regex.test(buildGradleContent)) {
      return buildGradleContent.replace(regex, `$1${newVersion}$2`);
    }
  }
  return null;
}

function updateLocalVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
): string | null {
  const regexes: RegExp[] = [
    ...moduleMapVariableVersionFormatMatch(dependency),
    moduleStringVariableInterpolationVersionFormatMatch(dependency),
    moduleStringVariableExpressionVersionFormatMatch(dependency),
    ...moduleKotlinNamedArgumentVariableVersionFormatMatch(dependency),
  ];
  for (const regex of regexes) {
    const match = regex.exec(buildGradleContent);
    if (match) {
      return buildGradleContent.replace(
        variableDefinitionFormatMatch(match[1]),
        `$1${newVersion}$3`
      );
    }
  }
  return null;
}

function updateGlobalVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
): string | null {
  const variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    const regex = variableDefinitionFormatMatch(variable);
    const match = regex.exec(buildGradleContent);
    if (match) {
      return buildGradleContent.replace(
        variableDefinitionFormatMatch(variable),
        `$1${newVersion}$3`
      );
    }
  }
  return null;
}

function updateGlobalMapVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
): string | null {
  let variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    while (variable && variable.split('.').length > 0) {
      const regex = variableMapDefinitionFormatMatch(
        variable,
        dependency.version
      );
      const match = regex.exec(buildGradleContent);
      if (match) {
        return buildGradleContent.replace(
          variableMapDefinitionFormatMatch(variable, dependency.version),
          `$1${newVersion}$3`
        );
      }

      // Remove first path segment of variable and try again
      variable = variable.split('.').splice(1).join('.');
    }
  }
  return null;
}

function updateKotlinVariablesByExtra(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
): string | null {
  const variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    const regex = new RegExp(
      `(val ${variable} by extra(?: {|\\()\\s*")(.*)("\\s*[})])`
    );
    const match = regex.exec(buildGradleContent);
    if (match) {
      return buildGradleContent.replace(regex, `$1${newVersion}$3`);
    }
  }
  return null;
}

function updatePropertyFileGlobalVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newVersion: string
): string | null {
  const variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    const regex = new RegExp(`(${variable}\\s*=\\s*)(.*)`);
    const match = regex.exec(buildGradleContent);
    if (match) {
      return buildGradleContent.replace(regex, `$1${newVersion}`);
    }
  }
  return null;
}

export function updateGradleVersion(
  buildGradleContent: string,
  dependency: GradleDependency,
  newVersion: string
): string {
  if (dependency) {
    const updateFunctions: UpdateFunction[] = [
      updateVersionLiterals,
      updateLocalVariables,
      updateGlobalVariables,
      updateGlobalMapVariables,
      updatePropertyFileGlobalVariables,
      updateKotlinVariablesByExtra,
    ];

    for (const updateFunction of updateFunctions) {
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

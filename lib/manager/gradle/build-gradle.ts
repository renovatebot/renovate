import { regEx } from '../../util/regex';
import { BuildDependency } from './gradle-updates-report';

/**
 * Functions adapted/ported from https://github.com/patrikerdes/gradle-use-latest-versions-plugin
 * gradle-use-latest-versions-plugin is licensed under MIT and Copyright (c) 2018 Patrik Erdes
 */

let variables: Record<string, string> = {};

export interface GradleDependency {
  group: string;
  name: string;
  version?: string;
}

interface UpdateFunction {
  (
    dependency: GradleDependency,
    buildGradleContent: string,
    newValue: string
  ): string;
}

const groovyQuotes = `(?:["'](?:""|'')?)`;
const groovyVersionVariable = `(?:${groovyQuotes}\\$)?{?([^\\s"'{}$)]+)}?${groovyQuotes}?`;
const kotlinVersionVariable = `(?:"\\$)?{?([^\\s"{}$]+?)}?"?`;

// https://github.com/patrikerdes/gradle-use-latest-versions-plugin/blob/8cf9c3917b8b04ba41038923cab270d2adda3aa6/src/main/groovy/se/patrikerdes/DependencyUpdate.groovy#L27-L29
function moduleStringVersionFormatMatch(dependency: GradleDependency): RegExp {
  return regEx(
    `(${groovyQuotes}${dependency.group}:${dependency.name}:)[^$].*?(([:@].*?)?${groovyQuotes})`
  );
}

function groovyPluginStringVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(
    `(id\\s+${groovyQuotes}${dependency.group}${groovyQuotes}\\s+version\\s+${groovyQuotes})[^"$].*?(${groovyQuotes})`
  );
}

function kotlinPluginStringVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(`(id\\("${dependency.group}"\\)\\s+version\\s+")[^$].*?(")`);
}

function dependencyStringVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(
    `(dependency\\s+['"]${dependency.group}:${dependency.name}:)[^'"]+(['"])`
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
  ].map((regex) => regEx(`${prefix}${regex}${postfix}`));
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
  const version = `version\\s*:\\s*${groovyVersionVariable}`;
  return allMapFormatOrders(group, name, version, '', '');
}

function moduleKotlinNamedArgumentVariableVersionFormatMatch(
  dependency: GradleDependency
): RegExp[] {
  // one capture group: the version variable
  const group = `group\\s*=\\s*"${dependency.group}"`;
  const name = `name\\s*=\\s*"${dependency.name}"`;
  const version = `version\\s*=\\s*${kotlinVersionVariable}`;
  return allMapFormatOrders(group, name, version, '', '[\\s),]');
}

function moduleStringVariableInterpolationVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(
    `${groovyQuotes}${dependency.group}:${dependency.name}:\\$([^{].*?)${groovyQuotes}`
  );
}

function moduleStringVariableExpressionVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(
    `${groovyQuotes}${dependency.group}:${dependency.name}:\\$` +
      `{([^{].*?)}${groovyQuotes}`
  );
}

function groovyPluginVariableVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(
    `id\\s+${groovyQuotes}${dependency.group}${groovyQuotes}\\s+version\\s+${groovyVersionVariable}(?:\\s|;|})`
  );
}

function kotlinPluginVariableVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(
    `id\\("${dependency.group}"\\)\\s+version\\s+${kotlinVersionVariable}(?:\\s|;|})`
  );
}

function kotlinImplementationVariableVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  // implementation("com.graphql-java", "graphql-java", graphqlVersion)
  return regEx(
    `(?:implementation|testImplementation)\\s*\\(\\s*['"]${dependency.group}['"]\\s*,\\s*['"]${dependency.name}['"]\\s*,\\s*([a-zA-Z_][a-zA-Z_0-9]*)\\s*\\)\\s*(?:\\s|;|})`
  );
}

function kotlinPluginVariableDotVersionFormatMatch(
  dependency: GradleDependency
): RegExp {
  // id("org.jetbrains.kotlin.jvm").version(kotlinVersion)
  return regEx(
    `id\\s*\\(\\s*"${dependency.group}"\\s*\\)\\s*\\.\\s*version\\s*\\(\\s*([a-zA-Z_][a-zA-Z_0-9]*)\\s*\\)\\s*(?:\\s|;|})`
  );
}

function dependencyStringVariableExpressionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(
    `\\s*dependency\\s+['"]${dependency.group}:${dependency.name}:` +
      // eslint-disable-next-line no-template-curly-in-string
      '${([^}]*)}' +
      `['"](?:\\s|;|})`
  );
}

function dependencyStringLiteralExpressionFormatMatch(
  dependency: GradleDependency
): RegExp {
  return regEx(
    `\\s*dependency\\s+['"]${dependency.group}:${dependency.name}:([^'"{}$]+)['"](?:\\s|;|})`
  );
}

function variableDefinitionFormatMatch(variable: string): RegExp {
  return regEx(`(${variable}\\s*=\\s*?["'])(.*)(["'])`);
}

function variableMapDefinitionFormatMatch(
  variable: string,
  version: string
): RegExp {
  return regEx(`(${variable}\\s*:\\s*?["'])(${version})(["'])`);
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
      groovyPluginVariableVersionFormatMatch(dependency),
      kotlinPluginVariableVersionFormatMatch(dependency),
      dependencyStringVariableExpressionFormatMatch(dependency),
      ...moduleMapVariableVersionFormatMatch(dependency),
      ...moduleKotlinNamedArgumentVariableVersionFormatMatch(dependency),
      kotlinImplementationVariableVersionFormatMatch(dependency),
      kotlinPluginVariableDotVersionFormatMatch(dependency),
    ];

    const depName = `${dependency.group}:${dependency.name}`;
    for (const regex of regexes) {
      const match = regex.exec(buildGradleContent);
      if (match) {
        variables[depName] = match[1];
      }
    }

    if (!dep.currentValue) {
      const dependencyLiteralRegex = dependencyStringLiteralExpressionFormatMatch(
        dependency
      );
      const currentValue = dependencyLiteralRegex.exec(buildGradleContent)?.[1];
      if (currentValue) {
        dep.currentValue = currentValue;
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
  newValue: string
): string | null {
  const regexes: RegExp[] = [
    moduleStringVersionFormatMatch(dependency),
    groovyPluginStringVersionFormatMatch(dependency),
    kotlinPluginStringVersionFormatMatch(dependency),
    dependencyStringVersionFormatMatch(dependency),
    ...moduleMapVersionFormatMatch(dependency),
    ...moduleKotlinNamedArgumentVersionFormatMatch(dependency),
  ];
  let result = buildGradleContent;
  for (const regex of regexes) {
    const match = regex.exec(result);
    if (match) {
      result = result.replace(match[0], `${match[1]}${newValue}${match[2]}`);
    }
  }
  return result === buildGradleContent ? null : result;
}

function updateLocalVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newValue: string
): string | null {
  const regexes: RegExp[] = [
    ...moduleMapVariableVersionFormatMatch(dependency),
    moduleStringVariableInterpolationVersionFormatMatch(dependency),
    moduleStringVariableExpressionVersionFormatMatch(dependency),
    groovyPluginVariableVersionFormatMatch(dependency),
    kotlinPluginVariableVersionFormatMatch(dependency),
    kotlinImplementationVariableVersionFormatMatch(dependency),
    ...moduleKotlinNamedArgumentVariableVersionFormatMatch(dependency),
  ];
  for (const regex of regexes) {
    const match = regex.exec(buildGradleContent);
    if (match) {
      const variableDefinitionRegex = variableDefinitionFormatMatch(match[1]);
      const variableDefinitionMatch = variableDefinitionRegex.exec(
        buildGradleContent
      );
      if (variableDefinitionMatch) {
        return buildGradleContent.replace(
          variableDefinitionMatch[0],
          `${variableDefinitionMatch[1]}${newValue}${variableDefinitionMatch[3]}`
        );
      }
    }
  }
  return null;
}

function updateGlobalVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newValue: string
): string | null {
  const variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    const regex = variableDefinitionFormatMatch(variable);
    const match = regex.exec(buildGradleContent);
    if (match) {
      return buildGradleContent.replace(
        match[0],
        `${match[1]}${newValue}${match[3]}`
      );
    }
  }
  return null;
}

function updateGlobalMapVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newValue: string
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
          match[0],
          `${match[1]}${newValue}${match[3]}`
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
  newValue: string
): string | null {
  const variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    const regex = regEx(
      `(val ${variable} by extra(?: {|\\()\\s*")(.*)("\\s*[})])`
    );
    const match = regex.exec(buildGradleContent);
    if (match) {
      return buildGradleContent.replace(
        match[0],
        `${match[1]}${newValue}${match[3]}`
      );
    }
  }
  return null;
}

function updatePropertyFileGlobalVariables(
  dependency: GradleDependency,
  buildGradleContent: string,
  newValue: string
): string | null {
  const variable = variables[`${dependency.group}:${dependency.name}`];
  if (variable) {
    const regex = regEx(`(${variable}\\s*=\\s*)(.*)`);
    const match = regex.exec(buildGradleContent);
    if (match) {
      return buildGradleContent.replace(match[0], `${match[1]}${newValue}`);
    }
  }
  return null;
}

export function updateGradleVersion(
  buildGradleContent: string,
  dependency: GradleDependency,
  newValue: string
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
        newValue
      );
      if (gradleContentUpdated) {
        return gradleContentUpdated;
      }
    }
  }
  return buildGradleContent;
}

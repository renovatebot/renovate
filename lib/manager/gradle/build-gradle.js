/**
 * Functions adapted/ported from https://github.com/patrikerdes/gradle-use-latest-versions-plugin
 * gradle-use-latest-versions-plugin is licensed under MIT and Copyright (c) 2018 Patrik Erdes
 */

let variables = {};

function updateGradleVersion(buildGradleContent, dependency, newVersion) {
  if (dependency) {
    const updateFunctions = [
      updateVersionStringFormat,
      updateVersionMapFormat,
      updateVersionMapVariableFormat,
      updateVersionStringVariableFormat,
      updatePluginVersionStringFormat,
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

function collectVersionVariables(dependencies, buildGradleContent) {
  for (const dep of dependencies) {
    const dependency = {
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

function init() {
  variables = {};
}

function updateVersionStringFormat(dependency, buildGradleContent, newVersion) {
  const regex = moduleStringVersionFormatMatch(dependency);
  if (buildGradleContent.match(regex)) {
    return buildGradleContent.replace(regex, `$1${newVersion}$2`);
  }
  return null;
}

function updateVersionMapFormat(dependency, buildGradleContent, newVersion) {
  const regex = moduleMapVersionFormatMatch(dependency);
  if (buildGradleContent.match(regex)) {
    return buildGradleContent.replace(regex, `$1${newVersion}$2`);
  }
  return null;
}

function updateVersionMapVariableFormat(
  dependency,
  buildGradleContent,
  newVersion
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
  dependency,
  buildGradleContent,
  newVersion
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

function updatePluginVersionStringFormat(
  dependency,
  buildGradleContent,
  newVersion
) {
  const pluginRegex = /(^|\n)\s*plugins\s+{\s*\n((.*\n)*?)\s*}/;
  const pluginContent = buildGradleContent.match(pluginRegex);
  if (!pluginContent) {
    logger.debug('Could not locate plugin block');
    return null;
  }
  const versionIdRegex = new RegExp(
    `(id\\s+('|")${dependency.name}('|")\\s+version\\s+'|").*?('|")`
  );
  const versionIdMatch = pluginContent[2].match(versionIdRegex);
  if (!versionIdMatch) {
    logger.info('Could not locate depName');
    return null;
  }
  const newPluginContent = pluginContent[2].replace(
    versionIdRegex,
    `$1${newVersion}$4`
  );
  return buildGradleContent.replace(pluginContent[2], newPluginContent);
}

function updateVersionExpressionVariableFormat(
  dependency,
  buildGradleContent,
  newVersion
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

function updateGlobalVariables(dependency, buildGradleContent, newVersion) {
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
  dependency,
  buildGradleContent,
  newVersion
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

function moduleStringVersionFormatMatch(dependency) {
  return new RegExp(
    `(["']${dependency.group}:${dependency.name}:)[^$].*?(["'])`
  );
}

function moduleMapVersionFormatMatch(dependency) {
  // prettier-ignore
  return new RegExp(
    `(group\\s*:\\s*["']${dependency.group}["']\\s*,\\s*` +
    `name\\s*:\\s*["']${dependency.name}["']\\s*,\\s*` +
    `version\\s*:\\s*["']).*?(["'])`
  );
}

function moduleMapVariableVersionFormatMatch(dependency) {
  // prettier-ignore
  return new RegExp(
    `group\\s*:\\s*["']${dependency.group}["']\\s*,\\s*` +
    `name\\s*:\\s*["']${dependency.name}["']\\s*,\\s*` +
    `version\\s*:\\s*([^\\s"']+?)\\s`
  );
}

function moduleStringVariableInterpolationVersionFormatMatch(dependency) {
  return new RegExp(
    `["']${dependency.group}:${dependency.name}:\\$([^{].*?)["']`
  );
}

function moduleStringVariableExpressionVersionFormatMatch(dependency) {
  return new RegExp(
    `["']${dependency.group}:${dependency.name}:\\$\{([^{].*?)}["']`
  );
}

function variableDefinitionFormatMatch(variable) {
  return new RegExp(`(${variable}\\s*=\\s*?["'])(.*)(["'])`);
}

module.exports = {
  updateGradleVersion,
  collectVersionVariables,
  init,
};

/**
 * Functions adapted/ported from https://github.com/patrikerdes/gradle-use-latest-versions-plugin
 * gradle-use-latest-versions-plugin is licensed under MIT and Copyright (c) 2018 Patrik Erdes
 */

function updateGradleVersion(buildGradleContent, dependency, newVersion) {
  if (dependency) {
    const updateFunctions = [
      updateVersionStringFormat,
      updateVersionMapFormat,
      updateVersionMapVariableFormat,
      updateVersionStringVariableFormat,
      updateVersionExpressionVariableFormat,
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
  return new RegExp(`(${variable}\\s+=\\s*?["'])(.*)(["'])`);
}

module.exports = {
  updateGradleVersion,
};

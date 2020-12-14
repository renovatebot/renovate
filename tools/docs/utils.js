const replaceStart =
  '<!-- Autogenerate in https://github.com/renovatebot/renovatebot.github.io -->';
const replaceStop = '<!-- Autogenerate end -->';

/**
 * @param {string} input
 */
export function capitalize(input) {
  // console.log(input);
  return input[0].toUpperCase() + input.slice(1);
}

/**
 * @param {string} input
 */
export function formatName(input) {
  return input.split('-').map(capitalize).join(' ');
}

/**
 * @param {string} moduleName
 */
export function getDisplayName(moduleName, moduleDefinition) {
  return moduleDefinition.displayName || formatName(moduleName);
}

/**
 * @param {string} moduleName
 */
export function getNameWithUrl(moduleName, moduleDefinition) {
  const displayName = getDisplayName(moduleName, moduleDefinition);
  if (moduleDefinition.url) {
    return `[${displayName}](${moduleDefinition.url})`;
  }
  return displayName;
}

/**
 * @param {string} content
 * @param {string} txt
 */
export function replaceContent(content, txt) {
  const replaceStartIndex = content.indexOf(replaceStart);
  const replaceStopIndex = content.indexOf(replaceStop);
  return (
    content.slice(0, replaceStartIndex + replaceStart.length) +
    txt +
    content.slice(replaceStopIndex)
  );
}

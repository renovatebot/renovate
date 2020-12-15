import { readFile } from '../utils/index.js';

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

/**
 * @param {string[]} urls
 */
export function formatUrls(urls) {
  if (urls?.length > 0) {
    return `**References**:\n\n${urls
      .map((url) => ` - [${url}](${url})`)
      .join('\n')}\n\n`;
  }
  return '';
}

/**
 * @param {string} type
 * @param {string} name
 */
export async function formatDescription(type, name) {
  const content = await readFile(`../../lib/${type}/${name}/readme.md`);
  if (!content) {
    return '';
  }
  return `**Description**:\n\n${content}\n`;
}

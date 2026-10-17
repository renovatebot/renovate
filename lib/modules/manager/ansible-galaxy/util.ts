import { regEx } from '../../../util/regex.ts';

export const newBlockRegEx = regEx(/^\s*-\s*(?:(?<key>\w+):\s*(?<value>.*))$/);
export const blockLineRegEx = regEx(/^\s*(?:(?<key>\w+):\s*(?<value>\S+))\s*$/);
export const galaxyDepRegex = regEx(/[\w-]+\.[\w-]+/);
export const dependencyRegex = regEx(/^dependencies:/);
export const galaxyRegEx = regEx(
  /^\s+["']?(?<packageName>[\w.]+)["']?:\s*["']?(?<version>.+?)["']?\s*(?:\s#.*)?$/,
);
export const nameMatchRegex = regEx(
  /(?<source>(?:(?:git\+)?(?:(?:git|ssh|https?):\/\/)?(?:.*@)?(?<hostname>[\w.-]+)(?:(?::\d+)?\/|:))(?<depName>[\w./-]+)(?:\.git)?)(?:,(?<version>[\w.]*))?/,
);

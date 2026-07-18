import { regEx } from '../../../util/regex.ts';

export const newBlockRegEx = /^\s*-\s*(?:(?<key>\w+):\s*(?<value>.*))$/;
export const blockLineRegEx = /^\s*(?:(?<key>\w+):\s*(?<value>\S+))\s*$/;
export const galaxyDepRegex = /[\w-]+\.[\w-]+/;
export const dependencyRegex = /^dependencies:/;
export const galaxyRegEx = regEx(
  /^\s+["']?(?<packageName>[\w.]+)["']?:\s*["']?(?<version>.+?)["']?\s*(?:\s#.*)?$/,
);
export const nameMatchRegex = regEx(
  /(?<source>(?:(?:git\+)?(?:(?:git|ssh|https?):\/\/)?(?:.*@)?(?<hostname>[\w.-]+)(?:(?::\d+)?\/|:))(?<depName>[\w./-]+)(?:\.git)?)(?:,(?<version>[\w.]*))?/,
);

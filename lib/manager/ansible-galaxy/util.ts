import { regEx } from '../../util/regex';

export const newBlockRegEx = /^\s*-\s*((\w+):\s*(.*))$/;
export const blockLineRegEx = /^\s*((\w+):\s*(.*))$/;
export const galaxyDepRegex = /[\w-]+\.[\w-]+/;
export const dependencyRegex = /^dependencies:/;
export const galaxyRegEx = regEx(
  /^\s+(?<lookupName>[\w.]+):\s*["'](?<version>.+)["']\s*/
);
export const nameMatchRegex = regEx(
  /(?<source>((git\+)?(?:(git|ssh|https?):\/\/)?(.*@)?(?<hostname>[\w.-]+)(?:(:\d+)?\/|:))(?<depName>[\w./-]+)(?:\.git)?)(,(?<version>[\w.]*))?/
);

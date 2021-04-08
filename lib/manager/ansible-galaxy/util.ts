export const newBlockRegEx = /^\s*-\s*((\w+):\s*(.*))$/;
export const blockLineRegEx = /^\s*((\w+):\s*(.*))$/;
export const galaxyDepRegex = /.+\..+/;
export const dependencyRegex = /^dependencies:/;
export const galaxyRegEx = /^\s+(?<lookupName>[\w.]+):\s*["'](?<version>.+)["']\s*/;
export const nameMatchRegex = /^(?<source>(git|http|git\+http|ssh)s?(:\/\/|@)(?<hostname>.*)(\/|:)(?<depName>.+\/[^.,]+)\/?(\.git)?)(,(?<version>.*))?$/;

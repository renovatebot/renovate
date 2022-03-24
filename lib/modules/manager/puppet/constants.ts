import { regEx } from "../../../util/regex";

export const simpleModuleLineRegexFactory = (): RegExp => /^mod\s*'([^']+)',\s*'([^']+)'$/gm;
export const gitModuleRegexFactory = (): RegExp => /^mod '(?<moduleName>[^']+)',(?![^\n])(?:\n\s+:(?<key1>\w+)\s+=>\s+'(?<value1>[^']+)',?)(?![^\n])(?:\n\s+:(?<key2>\w+)\s+=>\s+'(?<value2>[^']+)',?)?(?![^\n])(?:\n\s+:(?<key3>\w+)\s+=>\s+'(?<value3>[^']+)',?)?/gm;
export const forgeRegexFactory = (): RegExp => /^forge\s+['"]([^'"]+)['"]$((?:\n|(?!^forge).)*)/gm;

export const RE_REPOSITORY_GITHUB_SSH_FORMAT = regEx(
  /(?:git@)github.com:([^/]+)\/([^/.]+)(?:\.git)?/
);

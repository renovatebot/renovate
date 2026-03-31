import { isNonEmptyString } from '@sindresorhus/is';
import type { PlatformId } from '../constants/index.ts';
import { regEx } from '../util/regex.ts';

const configFileNames = [
  'renovate.json',
  'renovate.json5',
  '.github/renovate.json',
  '.github/renovate.json5',
  '.gitlab/renovate.json',
  '.gitlab/renovate.json5',
  '.renovaterc',
  '.renovaterc.json',
  '.renovaterc.json5',
  'package.json',
];

let userAddedConfigFileNames: string[] = [];

export function setUserConfigFileNames(fileNames: string[]): void {
  userAddedConfigFileNames = fileNames;
}

export function getConfigFileNames(platform?: PlatformId): string[] {
  let filteredConfigFileNames = [...configFileNames];

  if (isNonEmptyString(platform)) {
    const platfromRe = regEx('\\.(?<platform>.*)\\/renovate\\.json[5]?$');
    filteredConfigFileNames = configFileNames.filter((filename) => {
      const matchResult = platfromRe.exec(filename);
      if (!matchResult) {
        return true;
      } else if (matchResult?.groups?.platform === platform) {
        return true;
      }

      return false;
    });

    if (!['github', 'gitlab'].includes(platform) && platform !== 'local') {
      filteredConfigFileNames.push(`.${platform}/renovate.json`);
      filteredConfigFileNames.push(`.${platform}/renovate.json5`);
    }
  }
  return [...userAddedConfigFileNames, ...filteredConfigFileNames];
}

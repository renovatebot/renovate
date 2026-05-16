import { isNonEmptyString } from '@sindresorhus/is';
import { braceExpand } from 'minimatch';
import type { PlatformId } from '../constants/index.ts';
import { regEx } from '../util/regex.ts';

const configFilePatterns = [
  'renovate.json{,5}',
  '.github/renovate.json{,5}',
  '.gitlab/renovate.json{,5}',
  '.renovaterc',
  '.renovaterc.json{,5}',
  'package.json',
];

const configFileNames = configFilePatterns.flatMap((p) => braceExpand(p));

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

import { logger } from '../logger';
import { GlobalConfig } from './global';

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

export function getConfigFileNames(): string[] {
  let allFileNames = [...userAddedConfigFileNames, ...configFileNames];
  const platform = GlobalConfig.get('platform');
  // should not happen
  if (!platform) {
    return allFileNames;
  }

  allFileNames = allFileNames.filter((filename) => {
    const parts = filename.split('/');
    if (parts.length === 1) {
      // No platform specified, include this file
      return true;
    }

    const platformName = parts[0].replace('.', '');
    return platformName === platform;
  });

  logger.debug({ allFileNames });
  return allFileNames;
}

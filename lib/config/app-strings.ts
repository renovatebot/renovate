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
  return [...userAddedConfigFileNames, ...configFileNames];
}

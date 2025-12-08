import { regEx } from '../../../util/regex';

const regex = regEx(/^(?<codename>\w+)-(?<date>\d{8})(?<suffix>\.\d{1,2})?$/);

function isDatedCodeName(input: string): boolean {
  return regex.test(input);
}

function getDatedContainerImageCodename(version: string): null | string {
  const groups = regex.exec(version);
  if (!groups?.groups) {
    return null;
  }
  return groups.groups.codename;
}

function getDatedContainerImageVersion(version: string): null | number {
  const groups = regex.exec(version);
  if (!groups?.groups) {
    return null;
  }

  return parseInt(groups.groups.date);
}

function getDatedContainerImageSuffix(version: string): null | string {
  const groups = regex.exec(version);
  if (!groups?.groups?.suffix) {
    return null;
  }

  return groups.groups.suffix;
}

export {
  isDatedCodeName,
  getDatedContainerImageCodename,
  getDatedContainerImageVersion,
  getDatedContainerImageSuffix,
};

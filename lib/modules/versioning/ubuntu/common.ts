import { regEx } from '../../../util/regex';

function isDatedCodeName(input: string): boolean {
  return regEx(/^(?<codename>\w+)-(?<date>\d{8})$/).test(input);
}

function getDatedContainerImageCodename(version: string): null | string {
  const groups = regEx(/^(?<codename>\w+)-(?<date>\d{8})$/).exec(version);
  if (!groups?.groups) {
    return null;
  }
  return groups.groups.codename;
}

function getDatedContainerImageVersion(version: string): null | number {
  const groups = regEx(/^(?<codename>\w+)-(?<date>\d{8})$/).exec(version);
  if (!groups?.groups) {
    return null;
  }

  return parseInt(groups.groups.date, 10);
}

export {
  isDatedCodeName,
  getDatedContainerImageCodename,
  getDatedContainerImageVersion,
};

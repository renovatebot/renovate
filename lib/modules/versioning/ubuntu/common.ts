function getDatedContainerImageCodename(version: string): null | string {
  const groups = /^(?<codename>\w+)-(?<date>\d{8})$/.exec(version);
  if (!groups?.groups) {
    return null;
  }
  return groups.groups.codename;
}

function getDatedContainerImageVersion(version: string): null | number {
  const groups = /^(?<codename>\w+)-(?<date>\d{8})$/.exec(version);
  if (!groups?.groups) {
    return null;
  }

  return parseInt(groups.groups.date, 10);
}

export { getDatedContainerImageCodename, getDatedContainerImageVersion };

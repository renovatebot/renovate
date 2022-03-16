import dataFiles from '../../../data-files.generated';

export type UbuntuDistroInfo = Record<string, string>;

// Data file generated with:
// ubuntu-distro-json-generate.mjs
const ubuntuJsonKey = 'data/ubuntu-distro-info.json';

const ubuntuDistroInfo: UbuntuDistroInfo = JSON.parse(
  dataFiles?.get(ubuntuJsonKey) ?? ''
);

const codenameToVersion = new Map<string, string>();

for (const version of Object.keys(ubuntuDistroInfo)) {
  const codename = ubuntuDistroInfo[version];
  codenameToVersion.set(codename, version);
}

export function isCodename(input: string): boolean {
  return codenameToVersion.has(input);
}

export function getVersionByCodename(input: string): string {
  const ver = codenameToVersion.get(input);
  if (ver) {
    return ver;
  }
  return input;
}

export function getCodenameByVersion(input: string): string {
  const codename = ubuntuDistroInfo[input];
  if (codename) {
    return codename;
  }
  // istanbul ignore next
  return input;
}

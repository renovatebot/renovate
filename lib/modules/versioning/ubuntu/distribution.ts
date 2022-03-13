import dataFiles from '../../../data-files.generated';

export type UbuntuDistroInfo = Record<string, string>;

// Data file generated with:
// ubuntu-distro-info --all -f | sed -r 's/Ubuntu|"|LTS //g; s/([0-9]+.[0-9]+) /\1=/; s/.*/\L&/; s/(=[a-z]*) [a-z]*/\1/g; s/^[ \t]*//' | jo
const dataFile = 'data/ubuntu-distro-info.json';

const ubuntuDistroInfo: UbuntuDistroInfo = JSON.parse(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  dataFiles.get(dataFile)!
);

const codenameToVersion = new Map<string, string>();
const versionToCodename = new Map<string, string>();

for (const version of Object.keys(ubuntuDistroInfo)) {
  const codename = ubuntuDistroInfo[version];
  versionToCodename.set(version, codename);
  codenameToVersion.set(codename, version);
}

export function isCodename(input: string): boolean {
  return !!codenameToVersion.get(input);
}

export function getVersionByCodename(input: string): string {
  const ver = codenameToVersion.get(input);
  if (ver) {
    return ver;
  }
  return input;
}

export function getCodenameByVersion(input: string): string | undefined {
  const codename = versionToCodename.get(input);
  if (codename) {
    return codename;
  }
  // istanbul ignore next
  return input;
}

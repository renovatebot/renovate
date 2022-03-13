import dataFiles from '../../../data-files.generated';

export type UbuntuDistroInfo = Record<string, string>;

const ubuntuDistroInfo: UbuntuDistroInfo = JSON.parse(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  dataFiles.get('data/ubuntu-distro-info.json')!
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
  return versionToCodename.get(input);
}

import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'ubuntu';
export const displayName = 'Ubuntu';
export const urls = ['https://changelogs.ubuntu.com/meta-release'];
export const supportsRanges = false;

const distroInfo = `Ubuntu 4.10 "Warty Warthog"
Ubuntu 5.04 "Hoary Hedgehog"
Ubuntu 5.10 "Breezy Badger"
Ubuntu 6.06 LTS "Dapper Drake"
Ubuntu 6.10 "Edgy Eft"
Ubuntu 7.04 "Feisty Fawn"
Ubuntu 7.10 "Gutsy Gibbon"
Ubuntu 8.04 LTS "Hardy Heron"
Ubuntu 8.10 "Intrepid Ibex"
Ubuntu 9.04 "Jaunty Jackalope"
Ubuntu 9.10 "Karmic Koala"
Ubuntu 10.04 LTS "Lucid Lynx"
Ubuntu 10.10 "Maverick Meerkat"
Ubuntu 11.04 "Natty Narwhal"
Ubuntu 11.10 "Oneiric Ocelot"
Ubuntu 12.04 LTS "Precise Pangolin"
Ubuntu 12.10 "Quantal Quetzal"
Ubuntu 13.04 "Raring Ringtail"
Ubuntu 13.10 "Saucy Salamander"
Ubuntu 14.04 LTS "Trusty Tahr"
Ubuntu 14.10 "Utopic Unicorn"
Ubuntu 15.04 "Vivid Vervet"
Ubuntu 15.10 "Wily Werewolf"
Ubuntu 16.04 LTS "Xenial Xerus"
Ubuntu 16.10 "Yakkety Yak"
Ubuntu 17.04 "Zesty Zapus"
Ubuntu 17.10 "Artful Aardvark"
Ubuntu 18.04 LTS "Bionic Beaver"
Ubuntu 18.10 "Cosmic Cuttlefish"
Ubuntu 19.04 "Disco Dingo"
Ubuntu 19.10 "Eoan Ermine"
Ubuntu 20.04 LTS "Focal Fossa"
Ubuntu 20.10 "Groovy Gorilla"
Ubuntu 21.04 "Hirsute Hippo"
Ubuntu 21.10 "Impish Indri"
Ubuntu 22.04 LTS "Jammy Jellyfish"`;

const codenameToVersion = new Map<string, string>();
const versionToCodename = new Map<string, string>();

// const populateMaps = (match): string =>
//   match.replace(/(\r?\n)/g, '$1// renovate-replace ');
//
// distroInfo.replace(/([\d]*\.\d*)* "(.*)/g, populateMaps);
const regex = /([\d]*\.\d*)( LTS)? "(.*) /g;
let match: RegExpMatchArray;
while ((match = regex.exec(distroInfo)) !== null) {
  versionToCodename.set(match[1], match[3].toLocaleLowerCase());
  codenameToVersion.set(match[3].toLocaleLowerCase(), match[1]);
}

function isCodename(input: string): boolean {
  return !!codenameToVersion.get(input?.toLocaleLowerCase());
}

function getVersionByCodename(input: string): string {
  const res = codenameToVersion.get(input?.toLocaleLowerCase());
  if (res) {
    return res;
  }
  return input;
}

// #12509
const temporarilyUnstable = ['22.04'];

// validation

function isValid(input: string): boolean {
  return (
    (typeof input === 'string' &&
      regEx(/^(0[4-5]|[6-9]|[1-9][0-9])\.[0-9][0-9](\.[0-9]{1,2})?$/).test(
        input
      )) ||
    isCodename(input)
  );
}

function isVersion(input: string): boolean {
  return isValid(input);
}

function isCompatible(version: string, _current?: string): boolean {
  return isValid(version);
}

function isSingleVersion(version: string): boolean {
  return isValid(version);
}

function isStable(version: string): boolean {
  const ver = getVersionByCodename(version);
  if (!isValid(ver)) {
    return false;
  }
  if (temporarilyUnstable.includes(ver)) {
    return false;
  }
  return regEx(/^\d?[02468]\.04/).test(ver);
}

// digestion of version

function getMajor(version: string): null | number {
  const ver = getVersionByCodename(version);
  if (isValid(ver)) {
    const [major] = ver.split('.');
    return parseInt(major, 10);
  }
  return null;
}

function getMinor(version: string): null | number {
  const ver = getVersionByCodename(version);
  if (isValid(ver)) {
    const [, minor] = ver.split('.');
    return parseInt(minor, 10);
  }
  return null;
}

function getPatch(version: string): null | number {
  const ver = getVersionByCodename(version);
  if (isValid(ver)) {
    const [, , patch] = ver.split('.');
    return patch ? parseInt(patch, 10) : null;
  }
  return null;
}

// comparison

function equals(version: string, other: string): boolean {
  return isVersion(version) && isVersion(other) && version === other;
}

function isGreaterThan(version: string, other: string): boolean {
  const xMajor = getMajor(version) ?? 0;
  const yMajor = getMajor(other) ?? 0;
  if (xMajor > yMajor) {
    return true;
  }
  if (xMajor < yMajor) {
    return false;
  }

  const xMinor = getMinor(version) ?? 0;
  const yMinor = getMinor(other) ?? 0;
  if (xMinor > yMinor) {
    return true;
  }
  if (xMinor < yMinor) {
    return false;
  }

  const xPatch = getPatch(version) ?? 0;
  const yPatch = getPatch(other) ?? 0;
  return xPatch > yPatch;
}

function getSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return versions.find((version) => equals(version, range)) ? range : null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return getSatisfyingVersion(versions, range);
}

function getNewValue(newValueConfig: NewValueConfig): string {
  let newVer = newValueConfig.newVersion;
  if (isCodename(newValueConfig.currentValue)) {
    if (isCodename(newVer)) {
      return newVer;
    }
    newVer = versionToCodename.get(newVer);
  }
  return newVer;
}

function sortVersions(version: string, other: string): number {
  if (equals(version, other)) {
    return 0;
  }
  if (isGreaterThan(version, other)) {
    return 1;
  }
  return -1;
}

function matches(version: string, range: string): boolean {
  return equals(version, range);
}

export const api: VersioningApi = {
  isCompatible,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,

  getMajor,
  getMinor,
  getPatch,

  equals,
  isGreaterThan,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,

  matches,
};

export default api;

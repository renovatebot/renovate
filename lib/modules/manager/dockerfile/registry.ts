import { regEx } from '../../../util/regex.ts';
import { RollingReleasesData } from '../../versioning/debian/common.ts';
import { DistroInfo } from '../../versioning/distro.ts';
import type { PackageDependency } from '../types.ts';

/**
 * The architecture the detected repositories are read for.
 *
 * A Dockerfile does not say which architectures it is built for, so the most
 * common one is assumed - override it with a `packageRules` entry when you
 * build for another.
 */
const arch = 'x86_64';
const binaryArch = 'amd64';

/** The Alpine repository, which serves one index per branch and component */
const alpineRegistry = 'https://dl-cdn.alpinelinux.org/alpine';

/**
 * The Alpine components to look in.
 *
 * `testing` is left out because it only exists on `edge`, and a package which
 * is only in `testing` cannot be installed from a released branch anyway.
 */
const alpineComponents = 'main,community';

/** The Wolfi repository, which Chainguard's images install from */
const wolfiRegistry = 'https://packages.wolfi.dev/os';

/** The Alpine image itself, e.g. `alpine` or `public.ecr.aws/docker/library/alpine` */
const alpineImageRegex = regEx(/^(?:.+\/)?alpine$/);

/** An Alpine release tag, e.g. `3.21` or `3.21.4` */
const alpineTagRegex = regEx(/^(?<branch>\d+\.\d+)(?:\.\d+)?$/);

/**
 * The Alpine release named by another image's tag, e.g. the `3.21` of
 * `node:22-alpine3.21`.
 *
 * A bare `-alpine` suffix names no release, so it is deliberately not matched.
 */
const alpineTagSuffixRegex = regEx(/\balpine(?<branch>\d+\.\d+)\b/);

/** A Wolfi-based image, e.g. `cgr.dev/chainguard/wolfi-base` */
const wolfiImageRegex = regEx(
  /^(?:cgr\.dev\/chainguard\/.+|(?:.+\/)?wolfi-base)$/,
);

/** Returns the Alpine branch which the `alpine` image's tag names */
function branchFromAlpineTag(
  currentValue: string | null | undefined,
): string | null {
  // an untagged image is the same as `alpine:latest`
  if (!currentValue || currentValue === 'latest') {
    return 'latest-stable';
  }

  if (currentValue === 'edge') {
    return 'edge';
  }

  const branch = alpineTagRegex.exec(currentValue)?.groups?.branch;
  return branch ? `v${branch}` : null;
}

/** Returns the Alpine branch which another image's tag names, if any */
function branchFromAlpineTagSuffix(
  currentValue: string | null | undefined,
): string | null {
  if (!currentValue) {
    return null;
  }

  const branch = alpineTagSuffixRegex.exec(currentValue)?.groups?.branch;
  return branch ? `v${branch}` : null;
}

/**
 * Works out which APK repository a base image installs from, so that `apk add`
 * is looked up against the packages the image actually has.
 *
 * Only images which name their distribution are recognised - an image such as
 * `vault:1.13.3` is built on Alpine, but its name does not say which release,
 * so no `registryUrl` is detected and the `apk` datasource falls back to its
 * default. Set the `registryUrls` yourself with a `packageRules` entry for
 * those, which also takes priority over what is detected here.
 *
 * @param image the `FROM` image of the stage the packages are installed in
 */
export function detectApkRegistryUrls(
  image: PackageDependency,
): string[] | undefined {
  const { depName, currentValue } = image;
  if (!depName) {
    return undefined;
  }

  if (wolfiImageRegex.test(depName)) {
    return [`${wolfiRegistry}?arch=${arch}`];
  }

  const branch = alpineImageRegex.test(depName)
    ? branchFromAlpineTag(currentValue)
    : branchFromAlpineTagSuffix(currentValue);
  if (!branch) {
    return undefined;
  }

  return [
    `${alpineRegistry}?branch=${branch}&components=${alpineComponents}&arch=${arch}`,
  ];
}

const debianRegistry = 'https://deb.debian.org/debian';
const debianComponents = 'main,contrib,non-free';

const ubuntuRegistry = 'https://archive.ubuntu.com/ubuntu';
const ubuntuSecurityRegistry = 'https://security.ubuntu.com/ubuntu';
const ubuntuComponents = 'main,restricted,universe,multiverse';

/** The Debian image itself, e.g. `debian` or `public.ecr.aws/docker/library/debian` */
const debianImageRegex = regEx(/^(?:.+\/)?debian$/);

/** The Ubuntu image itself, e.g. `ubuntu` or `public.ecr.aws/docker/library/ubuntu` */
const ubuntuImageRegex = regEx(/^(?:.+\/)?ubuntu$/);

/** A point release, e.g. the `12.11` Debian is also tagged with */
const pointReleaseRegex = regEx(/^(?<major>\d+)\.\d+$/);

/** Tag suffixes which describe the image's contents rather than its release */
const variantSuffixRegex = regEx(/-slim$/);
const buildDateSuffixRegex = regEx(/-\d{8}(?:\.\d{1,2})?$/);

const debianDistroInfo = new DistroInfo('data/debian-distro-info.json');
const debianRollingReleases = new RollingReleasesData(debianDistroInfo);
const ubuntuDistroInfo = new DistroInfo('data/ubuntu-distro-info.json');

/**
 * Strips the parts of a tag which do not name a release, e.g. the
 * `bookworm-20240110-slim` of `debian:bookworm-20240110-slim`.
 */
function stripTagSuffixes(currentValue: string): string {
  return currentValue
    .replace(variantSuffixRegex, '')
    .replace(buildDateSuffixRegex, '');
}

/** Returns the codename of a release named by either codename or version */
function resolveCodename(
  distroInfo: DistroInfo,
  release: string,
): string | null {
  if (distroInfo.isCodename(release)) {
    return release;
  }

  if (distroInfo.exists(release)) {
    return distroInfo.getCodenameByVersion(release);
  }

  // Debian is also tagged with its point release, which names no suite of its own
  const major = pointReleaseRegex.exec(release)?.groups?.major;
  if (major && distroInfo.exists(major)) {
    return distroInfo.getCodenameByVersion(major);
  }

  return null;
}

/**
 * Returns the codename which the `debian` image's tag names.
 *
 * Debian's rolling aliases resolve to the release they currently point at, so
 * that the suites Renovate reads stay the ones the image was built from.
 */
function codenameFromDebianTag(
  currentValue: string | null | undefined,
): string | null {
  // an untagged image, and `debian:latest`, are the current stable release
  const tag = currentValue ? stripTagSuffixes(currentValue) : 'latest';
  const release = tag === 'latest' ? 'stable' : tag;
  return resolveCodename(
    debianDistroInfo,
    debianRollingReleases.getVersionByLts(release),
  );
}

/**
 * Returns the codename which the `ubuntu` image's tag names.
 *
 * Unlike Debian, Ubuntu's floating tags (`latest`, `rolling`, `devel`) name no
 * suite which Renovate could read, so they are left undetected.
 */
function codenameFromUbuntuTag(
  currentValue: string | null | undefined,
): string | null {
  if (!currentValue) {
    return null;
  }

  return resolveCodename(ubuntuDistroInfo, stripTagSuffixes(currentValue));
}

/**
 * The suites a Debian release installs from.
 *
 * Only the release's own suite is read: Debian folds `-updates` and `-security`
 * into it at each point release, and those two suites publish their index as
 * `Packages.xz` only, which the `deb` datasource cannot read.
 */
function debianRegistryUrls(codename: string): string[] {
  return [
    `${debianRegistry}?suite=${codename}&components=${debianComponents}&binaryArch=${binaryArch}`,
  ];
}

/**
 * The suites an Ubuntu release installs from.
 *
 * Ubuntu never republishes its release suite, so a pinned version usually comes
 * from `-updates` or `-security` instead and all three are read.
 */
function ubuntuRegistryUrls(codename: string): string[] {
  const params = `components=${ubuntuComponents}&binaryArch=${binaryArch}`;
  return [
    `${ubuntuRegistry}?suite=${codename}&${params}`,
    `${ubuntuRegistry}?suite=${codename}-updates&${params}`,
    `${ubuntuSecurityRegistry}?suite=${codename}-security&${params}`,
  ];
}

/**
 * Returns the repositories which another image's tag names, e.g. the Debian
 * `bookworm` repositories of `node:22-bookworm-slim`.
 *
 * Images built on Debian or Ubuntu name the release last, after the tag's own
 * version and variant, so only the last part of the tag is read as a codename.
 */
function registryUrlsFromTagSuffix(
  currentValue: string | null | undefined,
): string[] | undefined {
  if (!currentValue) {
    return undefined;
  }

  const suffix = stripTagSuffixes(currentValue).split('-').pop()!;

  if (debianDistroInfo.isCodename(suffix)) {
    return debianRegistryUrls(suffix);
  }

  if (ubuntuDistroInfo.isCodename(suffix)) {
    return ubuntuRegistryUrls(suffix);
  }

  return undefined;
}

/**
 * Works out which Debian repositories a base image installs from, so that
 * `apt install` is looked up against the packages the image actually has.
 *
 * Only images which name their release are recognised - an image such as
 * `node:22` is built on Debian, but its name does not say which release, so no
 * `registryUrl` is detected and the `deb` datasource falls back to its default.
 * Set the `registryUrls` yourself with a `packageRules` entry for those, which
 * also takes priority over what is detected here.
 *
 * @param image the `FROM` image of the stage the packages are installed in
 */
export function detectDebRegistryUrls(
  image: PackageDependency,
): string[] | undefined {
  const { depName, currentValue } = image;
  if (!depName) {
    return undefined;
  }

  if (debianImageRegex.test(depName)) {
    const codename = codenameFromDebianTag(currentValue);
    return codename ? debianRegistryUrls(codename) : undefined;
  }

  if (ubuntuImageRegex.test(depName)) {
    const codename = codenameFromUbuntuTag(currentValue);
    return codename ? ubuntuRegistryUrls(codename) : undefined;
  }

  return registryUrlsFromTagSuffix(currentValue);
}
